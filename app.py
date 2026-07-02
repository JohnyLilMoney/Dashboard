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

START_COMMANDS = {'ai': 'ai', 'mc': 'mc'}

@app.route('/')
def index():
    user_agent = request.headers.get('User-Agent', '').lower()
    is_mobile = any(device in user_agent for device in ['mobile', 'android', 'iphone', 'ipad'])

    animation_pack = None
    if not is_mobile:
        backgrounds_path = os.path.join(app.static_folder, 'backgrounds')
        if os.path.exists(backgrounds_path):
            packs = [d for d in os.listdir(backgrounds_path)
                     if os.path.isdir(os.path.join(backgrounds_path, d))]
            if packs:
                animation_pack = random.choice(packs)

    return render_template('index.html', animation_pack=animation_pack)

def get_available_backgrounds():
    """Get list of available background pack folders"""
    backgrounds_path = os.path.join(app.static_folder, 'backgrounds')
    if os.path.exists(backgrounds_path):
        return [d for d in os.listdir(backgrounds_path) 
                if os.path.isdir(os.path.join(backgrounds_path, d))]
    return []

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
