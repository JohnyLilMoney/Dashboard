import sqlite3
from dotenv import load_dotenv
load_dotenv('/home/johny/dashboard/.env')
from ssh import ssh_command, ssh_output
from db import close_db, init_db, query_db, update_db, get_background_scores, modify_db, DB_PATH
import os

if not os.path.exists(DB_PATH):
    print(f"Database file '{DB_PATH}' not found. Initializing...")
    init_db()
else:
    print(f"Database file '{DB_PATH}' found.")

update_db()

from flask import Flask, jsonify, render_template, request
import subprocess
import re
import socket
import json
import time
import threading
from concurrent.futures import ThreadPoolExecutor
import logging
from mcstatus import JavaServer
import requests
import random
import secrets
import ipaddress
from werkzeug.security import check_password_hash

app = Flask(__name__, static_folder='static', template_folder='templates')
app.teardown_appcontext(close_db)

from werkzeug.middleware.proxy_fix import ProxyFix
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

AMS_TZ = ZoneInfo("Europe/Amsterdam")

TEST = 445
START_TIMEOUT = 120

log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

OLLAMA_HOST = "http://100.100.1.1:11434"

ZYXEL_HOST = "https://192.168.1.1"
ZYXEL_ACCOUNT = "admin"
ZYXEL_PASSWORD_B64 = os.environ.get('ZYXEL_PASSWORD_B64')
ZYXEL_POLL_INTERVAL = 1800

_pending_starts = {}
_pending_lock = threading.Lock()

_router_cache = {'uptime_seconds': None, 'next_reset_in': None, 'updated_at': 0}
_router_lock = threading.Lock()
_shutdown = threading.Event()

def _fetch_zyxel_uptime():
    if not ZYXEL_PASSWORD_B64:
        return None
    try:
        s = requests.Session()
        s.verify = False
        s.get(f"{ZYXEL_HOST}/getRSAPublickKey", timeout=5)
        login_payload = {
            "Input_Account": ZYXEL_ACCOUNT,
            "Input_Passwd": ZYXEL_PASSWORD_B64,
            "currLang": "nl",
            "RememberPassword": 0,
            "SHA512_password": False
        }
        login_resp = s.post(
            f"{ZYXEL_HOST}/UserLogin",
            json=login_payload,
            timeout=5
        )
        if login_resp.json().get('result') != 'ZCFG_SUCCESS':
            return None

        status_resp = s.get(f"{ZYXEL_HOST}/cgi-bin/DAL?oid=status", timeout=5)
        data = status_resp.json()
        return data['Object'][0]['DeviceInfo']['UpTime']
    except Exception:
        return None

def _format_duration(seconds):
    days = seconds // 86400
    hours = (seconds % 86400) // 3600
    minutes = (seconds % 3600) // 60
    parts = []
    if days: parts.append(f"{days}d")
    if hours: parts.append(f"{hours}h")
    if minutes or not parts: parts.append(f"{minutes}m")
    return ' '.join(parts)

def _router_poll_loop():
    while not _shutdown.is_set():
        uptime = _fetch_zyxel_uptime()
        if uptime is not None:
            next_reset_in = 86400 - (uptime % 86400)
            reset_time = datetime.now(AMS_TZ) + timedelta(seconds=next_reset_in)
            with _router_lock:
                _router_cache['uptime_seconds'] = uptime
                _router_cache['reset_time'] = reset_time
                _router_cache['updated_at'] = time.time()
        _shutdown.wait(ZYXEL_POLL_INTERVAL)
        
def get_router_status():
    with _router_lock:
        cache = dict(_router_cache)
    if cache.get('reset_time') is None:
        return {
            'status': 'online',
            'uptime': '--',
            'details': {'Expected IP Refresh': '--'}
        }
    return {
        'status': 'online',
        'uptime': _format_duration(cache['uptime_seconds']),
        'details': {'Expected IP Refresh': cache['reset_time'].strftime('%H:%M')}
    }

threading.Thread(target=_router_poll_loop, daemon=True).start()

def mark_start_pending(name):
    with _pending_lock:
        _pending_starts[name] = time.time()

def wol(mac):
    subprocess.run(['wol', mac])
    return True

COMMANDS = {
    'aireboot':   lambda: ssh_command('100.100.1.1', 'sudo reboot'),
    'mcreboot':   lambda: ssh_command('100.100.1.2', 'sudo reboot'),
    'aishutdown': lambda: ssh_command('100.100.1.1', 'sudo poweroff'),
    'mcshutdown': lambda: ssh_command('100.100.1.2', 'sudo shutdown -h now'),
    'ai':         lambda: wol('04:7c:16:d7:3c:bf'),
    'mc':         lambda: wol('ec:b1:d7:3e:44:45'),
    'mcips':      lambda: "Default: johnylilmoney.nl | TailScale: ts.johnylilmoney.nl | ZeroTier: zt.johnylilmoney.nl",
    'whatsthis':  lambda: "Odido Klik en Klaar comes with a dynamic ip. This means that the ip changes whenever the router starts, and every 24h after that. When this happens, people not using tailscale/zerotier won't be able to connect to the website for 0-2 minutes, and mc players will be kicked. The expected refresh is only the next one if the router doesn't lose power until then."
}

START_COMMANDS = {'ai': 'ai', 'mc': 'mc', 'aireboot': 'ai', 'mcreboot': 'mc'}
PROTECTED_COMMANDS = {name for name in COMMANDS if name not in ('mcips', 'whatsthis')}

PASSWORD_HASH = os.environ.get('DASHBOARD_PASSWORD_HASH')

TOKEN_TTL_SECONDS = 43200
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_SECONDS = 60

_valid_tokens = {}
_tokens_lock = threading.Lock()

_failed_attempts = {}
_attempts_lock = threading.Lock()

TRUSTED_NETWORKS = [ipaddress.ip_network('100.100.0.0/16')] # My custrom ip range, use 100.64.0.0/24 or smth if you have the default ts ip range

def _request_is_trusted():
    if not TRUSTED_NETWORKS:
        return False
    try:
        addr = ipaddress.ip_address(request.remote_addr)
    except (ValueError, TypeError):
        return False
    return any(addr in net for net in TRUSTED_NETWORKS)

@app.route('/api/is_tailscale')
def is_tailscale():
    return jsonify({'trusted': _request_is_trusted()})

def _is_locked_out(ip):
    with _attempts_lock:
        _, locked_until = _failed_attempts.get(ip, (0, 0))
        return time.time() < locked_until


def _register_failed_attempt(ip):
    with _attempts_lock:
        count, locked_until = _failed_attempts.get(ip, (0, 0))
        count += 1
        if count >= MAX_LOGIN_ATTEMPTS:
            locked_until = time.time() + LOCKOUT_SECONDS
            count = 0
        _failed_attempts[ip] = (count, locked_until)


def _clear_failed_attempts(ip):
    with _attempts_lock:
        _failed_attempts.pop(ip, None)


def _issue_token():
    token = secrets.token_urlsafe(32)
    with _tokens_lock:
        _valid_tokens[token] = time.time() + TOKEN_TTL_SECONDS
    return token

def _token_is_valid(token):
    if not token:
        return False
    with _tokens_lock:
        expiry = _valid_tokens.get(token)
        if expiry is None:
            return False
        if time.time() > expiry:
            del _valid_tokens[token]
            return False
        return True

def get_tailscale_identity(ip):
    try:
        result = subprocess.run(
            ["tailscale", "whois", "--json", ip],
            capture_output=True, text=True, timeout=2, check=True
        )
        data = json.loads(result.stdout)
        return data.get("Node", {}).get("Hostinfo", {}).get("Hostname")
    except Exception:
        return None

def get_tailscale_user_for_request():
    if not _request_is_trusted():
        return None
    return get_tailscale_identity(request.remote_addr)

HEADER_PREFIXES = ["Fakka", "Ewa", "Yo"]

def build_header():
    name = get_tailscale_user_for_request()
    if not name:
        return "Servers"
    return f"{random.choice(HEADER_PREFIXES)} {name}"

@app.route('/api/authenticate', methods=['POST'])
def authenticate():
    ip = request.remote_addr

    if not PASSWORD_HASH:
        return jsonify({'error': 'server has no password configured'}), 500

    if _is_locked_out(ip):
        return jsonify({'error': 'too many attempts, try again in a minute'}), 429

    data = request.get_json(silent=True) or {}
    password = data.get('password', '')

    if check_password_hash(PASSWORD_HASH, password):
        _clear_failed_attempts(ip)
        return jsonify({'token': _issue_token()})

    _register_failed_attempt(ip)
    time.sleep(0.5)
    return jsonify({'error': 'incorrect password'}), 401

@app.route('/')
def index():
    user_agent = request.headers.get('User-Agent', '').lower()
    is_mobile = any(device in user_agent for device in ['mobile', 'android', 'iphone', 'ipad'])

    animation_pack = None

    exclude = request.args.get("exclude")

    if not is_mobile:
        packs = get_available_backgrounds(exclude)

        if packs:
            animation_pack = random.choice(packs)

    return render_template('index.html', animation_pack=animation_pack)

def get_available_backgrounds(exclude=None):
    backgrounds_path = os.path.join(app.static_folder, 'backgrounds')

    if not os.path.exists(backgrounds_path):
        return []

    if not exclude:
        packs = [
            d for d in os.listdir(backgrounds_path)
            if os.path.isdir(os.path.join(backgrounds_path, d))
        ]
    else:
        packs = [
            d for d in os.listdir(backgrounds_path)
            if os.path.isdir(os.path.join(backgrounds_path, d)) and d != exclude
        ]

    if exclude:
        packs = [p for p in packs if p != exclude]

    if not _request_is_trusted():
        return packs

    ip = request.remote_addr
    scores = get_background_scores(ip)
    packs2 = []
    for score in scores:
        background, votes = score
        for i in range(votes):
            packs2.append(background)
    if packs2:
        return packs2
    else:
        return packs

@app.route('/<pack_name>')
def background_pack(pack_name):
    available_packs = get_available_backgrounds()
    
    if pack_name in available_packs:
        user_agent = request.headers.get('User-Agent', '').lower()
        is_mobile = any(device in user_agent for device in ['mobile', 'android', 'iphone', 'ipad'])
        
        if is_mobile:
            animation_pack = None
        else:
            animation_pack = pack_name
    else:
        animation_pack = None
    
    return render_template('index.html', animation_pack=animation_pack)

@app.route('/api/header')
def api_header():
    return jsonify({'header': build_header()})

@app.route('/api/run/<name>', methods=['POST'])
def run_command(name):
    if name not in COMMANDS:
        return {'error': 'unknown command'}, 404

    if name in PROTECTED_COMMANDS and not _request_is_trusted():
        token = request.headers.get('X-Auth-Token')
        if not _token_is_valid(token):
            return {'error': 'auth required'}, 401

    try:
        result = COMMANDS[name]()
    except Exception as e:
        return {'error': str(e)}, 500

    if not result:
        return {'error': 'command failed'}, 500

    if name in START_COMMANDS:
        mark_start_pending(START_COMMANDS[name])

    return {'ok': result}

@app.route('/api/like_background')
def like_background(background: str):
    if not _request_is_trusted():
        return jsonify({'error': 'tailscale users only'}), 403

    if not background:
        return jsonify({'error': 'bad request, no background provided'}), 401

    votes: int
    ip = request.remote_addr
    row = query_db("SELECT score FROM user_backgrounds WHERE user_ip = ? AND background_name = ?", (ip, background), one=True)
    if row is None:
        modify_db("INSERT INTO users (ip) VALUES (?)", (ip,))
        votes = 5
    else:
        try:
            votes = int(row[0])
        except (ValueError, TypeError):
            return jsonify({'error': 'Score data is corrupted or not a number'}), 500

    if votes < 10:
        votes += 1
        modify_db("INSERT OR REPLACE INTO user_backgrounds (user_ip, background_name, score) VALUES (?, ?, ?)", (ip, background, votes))
        return jsonify({'ok': True, 'new_score': votes}), 200
    else:
        return jsonify({'ok': False, 'new_score': votes}), 200

@app.route('/api/dislike_background')
def dislike_background(background: str):
    if not _request_is_trusted():
        return jsonify({'error': 'tailscale users only'}), 403

    if not background:
        return jsonify({'error': 'bad request, no background provided'}), 401

    votes: int
    ip = request.remote_addr
    row = query_db("SELECT score FROM user_backgrounds WHERE user_ip = ? AND background_name = ?", (ip, background), one=True)
    if row is None:
        modify_db("INSERT INTO users (ip) VALUES (?)", (ip,))
        votes = 5
    else:
        try:
            votes = int(row[0])
        except (ValueError, TypeError):
            return jsonify({'error': 'Score data is corrupted or not a number'}), 500

    if votes > 1:
        votes -= 1
        modify_db("INSERT OR REPLACE INTO user_backgrounds (user_ip, background_name, score) VALUES (?, ?, ?)", (ip, background, votes))
        return jsonify({'ok': True, 'new_score': votes}), 200
    else:
        return jsonify({'ok': False, 'new_score': votes}), 200
    
@app.route('/api/ollama/ps')
def ollama_ps():
    try:
        resp = requests.get(f"{OLLAMA_HOST}/api/ps", timeout=1)
        resp.raise_for_status()
        return jsonify(resp.json())
    except Exception as e:
        return jsonify({"error": str(e), "models": []}), 200

@app.route('/api/ollama/tags')
def ollama_tags():
    try:
        resp = requests.get(f"{OLLAMA_HOST}/api/tags", timeout=1)
        resp.raise_for_status()
        return jsonify(resp.json())
    except Exception as e:
        return jsonify({"error": str(e), "models": []}), 200

def ping_minecraft(ip, port=25565):
    try:
        server = JavaServer(ip, port, timeout=1)
        status = server.status(tries=1)

        players = []

        if status.players.sample:
            players = [
                {
                    "name": p.name,
                    "id": p.id
                }
                for p in status.players.sample
            ]

        return {
            "online": True,
            "online_players": status.players.online,
            "max_players": status.players.max,
            "players_list": players,
            "latency": round(status.latency, 2),
            "version": status.version.name,
            "motd": status.description
        }

    except Exception as e:
        return {
            "online": False,
            "error": str(e),
            "online_players": 0,
            "max_players": 0,
            "players_list": []
        }

def _check_windows_alive(ip, port):
    try:
        s = socket.create_connection((ip, port), timeout=1)
        s.close()
        return True
    except ConnectionRefusedError:
        return True
    except (socket.timeout, OSError):
        return False

def get_local_uptime():
    """Read system uptime from /proc/uptime, return human-readable string."""
    try:
        with open('/proc/uptime', 'r') as f:
            uptime_seconds = float(f.readline().split()[0])
        days = int(uptime_seconds // 86400)
        hours = int((uptime_seconds % 86400) // 3600)
        minutes = int((uptime_seconds % 3600) // 60)
        parts = []
        if days > 0:
            parts.append(f"{days}d")
        if hours > 0:
            parts.append(f"{hours}h")
        if minutes > 0 or (days == 0 and hours == 0):
            parts.append(f"{minutes}m")
        return ' '.join(parts) if parts else '<1m'
    except Exception:
        return '--'

def get_local_mail_status():
    return {
        'status': 'online',
        'uptime': get_local_uptime(),
        'details': {}
    }

def get_server_status(ip, is_mc=False):
    with ThreadPoolExecutor(max_workers=2) as ex:
        ssh_future = ex.submit(ssh_output, ip, 'uptime')
        if is_mc:
            mc_future = ex.submit(ping_minecraft, ip)
        else:
            win_future = ex.submit(_check_windows_alive, '100.100.2.2', TEST)

        try:
            output = ssh_future.result()
        except Exception:
            output = None

        if not output:
            if not is_mc and win_future.result():
                return {
                    'status': 'unavailable',
                    'uptime': None,
                    'details': {'Loaded Model': 'Booted into Windows'},
                    'models_list': []
                }
            status_data = {'status': 'offline', 'uptime': None, 'details': {}}
            if is_mc:
                status_data['details']['Players Online'] = '0'
                status_data['players_list'] = []
            else:
                status_data['details']['Loaded Model'] = '--'
                status_data['models_list'] = []
            return status_data

        output = output.strip()
        status_data = {
            'status': 'online',
            'uptime': '--',
            'details': {}
        }

    if 'up ' in output:
        parts = output.split('up ')
        if len(parts) > 1:
            uptime_string = parts[1].split(',')[0].strip()

            days_match = re.search(r'(\d+)\s+day', uptime_string)
            days = f"{days_match.group(1)}d " if days_match else ""

            time_remainder = re.sub(r'\d+\s+days?\,?\s*', '', uptime_string)

            if ':' in time_remainder:
                h_m = time_remainder.split(':')
                status_data['uptime'] = (
                    f"{days}{int(h_m[0])}h {int(h_m[1])}m"
                )
            else:
                min_match = re.search(r'(\d+)\s+min', time_remainder)
                if min_match:
                    status_data['uptime'] = (
                        f"{days}{min_match.group(1)}m"
                    )

                hour_match = re.search(r'(\d+)\s+hour', time_remainder)
                if hour_match:
                    status_data['uptime'] = (
                        f"{days}{hour_match.group(1)}h"
                    )

        if is_mc:
            mc_info = mc_future.result()
            if mc_info.get('online'):
                status_data['details']['Players Online'] = (
                    f"{mc_info.get('online_players', 0)}/{mc_info.get('max_players', 0)}"
                )
                status_data['players_list'] = mc_info.get('players_list', [])
            else:
                status_data['details']['Players Online'] = '0'
                status_data['players_list'] = []
        else:
            status_data['details'] = {'Loaded Model': '--'}
            status_data['models_list'] = []

        return status_data

def get_display_status(name, ip, is_mc):
    """Wraps get_server_status with the shared 'starting' overlay."""
    real_status = get_server_status(ip, is_mc)

    with _pending_lock:
        started_at = _pending_starts.get(name)
        if started_at is None:
            return real_status

        if real_status['status'] in ('online', 'unavailable'):
            del _pending_starts[name]
            return real_status

        if time.time() - started_at > START_TIMEOUT:
            del _pending_starts[name]
            return real_status

        starting_status = dict(real_status)
        starting_status['status'] = 'starting'
        return starting_status

_status_cache = {}
_cache_lock = threading.Lock()
_last_client_seen = 0.0
_seen_lock = threading.Lock()

POLL_INTERVAL = 1       
IDLE_TIMEOUT = 15

_cache_updated_at = 0.0

def _status_loop():
    global _cache_updated_at
    while not _shutdown.is_set():
        with _seen_lock:
            idle = time.time() - _last_client_seen > IDLE_TIMEOUT
        if not idle:
            fresh = _do_status_check()
            with _cache_lock:
                _status_cache.update(fresh)
                _cache_updated_at = time.time()
        _shutdown.wait(POLL_INTERVAL)

def _do_status_check():
    servers = {'ai': ('100.100.1.1', False), 'mc': ('100.100.1.2', True)}
    result = {'mail': get_local_mail_status(), 'router': get_router_status()}
    with ThreadPoolExecutor(max_workers=len(servers)) as executor:
        futures = {name: executor.submit(get_display_status, name, ip, is_mc)
                   for name, (ip, is_mc) in servers.items()}
        for name, future in futures.items():
            result[name] = future.result()
    return result

threading.Thread(target=_status_loop, daemon=True).start()

@app.route('/api/status')
def api_status():
    global _last_client_seen, _cache_updated_at
    with _seen_lock:
        _last_client_seen = time.time()
    with _cache_lock:
        stale = (time.time() - _cache_updated_at) > IDLE_TIMEOUT
        if stale:
            fresh = _do_status_check()
            _status_cache.update(fresh)
            _cache_updated_at = time.time()
        return dict(_status_cache)

# for use with flask, won't run if used with gunicorn
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=80, threaded=True)
