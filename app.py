from dotenv import load_dotenv
load_dotenv() 
from ssh_utils import ssh_command, ssh_output
from flask import Flask, send_from_directory, jsonify, render_template, request, jsonify
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
import os
import random
import secrets
import ipaddress
from werkzeug.security import check_password_hash

TEST = 445
START_TIMEOUT = 120

log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

app = Flask(__name__, static_folder='static', template_folder='templates')

OLLAMA_HOST = "http://100.100.1.1:11434"

_pending_starts = {}
_pending_lock = threading.Lock()

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
    'mcips':      lambda: "TailScale: johnylilmoney.nl | ZeroTier: zt.johnylilmoney.nl"
}

START_COMMANDS = {'ai': 'ai', 'mc': 'mc', 'aireboot': 'ai', 'mcreboot': 'mc'}

# ---------------------------------------------------------------------------
# Auth for the power buttons (start/restart/poweroff).
#
# Model: the browser asks for a password once, exchanges it for a short-lived
# random token, and reuses that token for every subsequent button press until
# the page is reloaded/closed. The password itself is never stored anywhere
# except as a hash you set via an environment variable.
#
# Set it like this before starting the app:
#   python3 -c "from werkzeug.security import generate_password_hash; print(generate_password_hash('your-password-here'))"
#   export DASHBOARD_PASSWORD_HASH='<paste the hash printed above>'
# ---------------------------------------------------------------------------

PASSWORD_HASH = os.environ.get('DASHBOARD_PASSWORD_HASH')

TOKEN_TTL_SECONDS = 60 * 60 * 12  # tokens are valid for 12h, then need a re-login
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_SECONDS = 60

_valid_tokens = {}       # token -> expiry timestamp
_tokens_lock = threading.Lock()

_failed_attempts = {}    # ip -> (fail_count, locked_until_timestamp)
_attempts_lock = threading.Lock()

# Commands that require a valid token before they're allowed to run.
# Everything except the purely informational 'mcips' lookup.
PROTECTED_COMMANDS = {name for name in COMMANDS if name != 'mcips'}

# --- Tailscale hook (not wired up yet, safe to leave empty for now) --------
# Once ts.johnylilmoney.nl is set up and the app is reachable through it in
# a way where request.remote_addr can be trusted (e.g. bound directly to the
# tailscale0 interface, or behind a reverse proxy on that interface that you
# control), add the tailnet's CGNAT range here and requests from it will
# skip the password prompt entirely. Nothing else needs to change.
TRUSTED_NETWORKS = []  # e.g. [ipaddress.ip_network('100.64.0.0/10')]


def _request_is_trusted():
    if not TRUSTED_NETWORKS:
        return False
    try:
        addr = ipaddress.ip_address(request.remote_addr)
    except (ValueError, TypeError):
        return False
    return any(addr in net for net in TRUSTED_NETWORKS)


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


@app.route('/api/authenticate', methods=['POST'])
def authenticate():
    ip = request.remote_addr

    if not PASSWORD_HASH:
        # Fails safe: if no password is configured, protected commands stay locked.
        return jsonify({'error': 'server has no password configured'}), 500

    if _is_locked_out(ip):
        return jsonify({'error': 'too many attempts, try again in a minute'}), 429

    data = request.get_json(silent=True) or {}
    password = data.get('password', '')

    if check_password_hash(PASSWORD_HASH, password):
        _clear_failed_attempts(ip)
        return jsonify({'token': _issue_token()})

    _register_failed_attempt(ip)
    time.sleep(0.5)  # slow down brute-forcing a little
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
    """Get list of available background pack folders."""
    backgrounds_path = os.path.join(app.static_folder, 'backgrounds')

    if not os.path.exists(backgrounds_path):
        return []

    packs = [
        d for d in os.listdir(backgrounds_path)
        if os.path.isdir(os.path.join(backgrounds_path, d))
    ]

    if exclude:
        packs = [p for p in packs if p != exclude]

    return packs

@app.route('/<pack_name>')
def background_pack(pack_name):
    """Load a specific background pack by name"""
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
        if name in START_COMMANDS:
            mark_start_pending(START_COMMANDS[name])
        return {'ok': result}
    except Exception as e:
        return {'error': str(e)}, 500

@app.route('/api/ollama/ps')
def ollama_ps():
    try:
        resp = requests.get(f"{OLLAMA_HOST}/api/ps", timeout=5)
        resp.raise_for_status()
        return jsonify(resp.json())
    except Exception as e:
        return jsonify({"error": str(e), "models": []}), 500

@app.route('/api/ollama/tags')
def ollama_tags():
    try:
        resp = requests.get(f"{OLLAMA_HOST}/api/tags", timeout=5)
        resp.raise_for_status()
        return jsonify(resp.json())
    except Exception as e:
        return jsonify({"error": str(e), "models": []}), 500

def ping_minecraft(ip, port=25565):
    try:
        server = JavaServer(ip, port)
        status = server.status()
        player_list = []
        if status.players.sample:
            for p in status.players.sample:
                player_list.append({
                    'name': p.name,
                    'id': p.id
                })
        return {
            'online': status.players.online,
            'max': status.players.max,
            'list': player_list
        }
    except Exception:
        return None

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
    try:
        output = ssh_output(ip, 'uptime')
    except Exception:
        output = None

    if not output:
        if not is_mc and _check_windows_alive('100.100.2.2', TEST):
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
        return status_data

    output = output.strip()
    status_data = {'status': 'online', 'uptime': '--', 'details': {}}
    if 'up ' in output:
        parts = output.split('up ')
        if len(parts) > 1:
            uptime_string = parts[1].split(',')[0].strip()
            days_match = re.search(r'(\d+)\s+day', uptime_string)
            days = f"{days_match.group(1)}d " if days_match else ""
            time_remainder = re.sub(r'\d+\s+days?\,?\s*', '', uptime_string)
            if ':' in time_remainder:
                h_m = time_remainder.split(':')
                status_data['uptime'] = f"{days}{int(h_m[0])}h {int(h_m[1])}m"
            else:
                min_match = re.search(r'(\d+)\s+min', time_remainder)
                if min_match:
                    status_data['uptime'] = f"{days}{min_match.group(1)}m"
                hour_match = re.search(r'(\d+)\s+hour', time_remainder)
                if hour_match:
                    status_data['uptime'] = f"{days}{hour_match.group(1)}h"

    if is_mc:
        mc_info = ping_minecraft(ip)
        if mc_info:
            status_data['details']['Players Online'] = f"{mc_info['online']}/{mc_info['max']}"
            status_data['players_list'] = mc_info['list']
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

@app.route('/api/status')
def api_status():
    servers = {'ai': ('100.100.1.1', False), 'mc': ('100.100.1.2', True)}
    result = {}

    result['mail'] = get_local_mail_status()
    
    with ThreadPoolExecutor(max_workers=len(servers)) as executor:
        futures = {
            name: executor.submit(get_display_status, name, ip, is_mc)
            for name, (ip, is_mc) in servers.items()
        }
        for name, future in futures.items():
            result[name] = future.result()
    return result

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=80)
