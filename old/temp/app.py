from ssh_utils import ssh_command, ssh_output
from flask import Flask, send_from_directory, jsonify
import subprocess
import re
import socket
import json
from concurrent.futures import ThreadPoolExecutor
import logging
from mcstatus import JavaServer
import requests

log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

app = Flask(__name__)

OLLAMA_HOST = "http://100.100.1.1:11434"

def wol(mac):
    subprocess.run(['wol', mac])
    return True

COMMANDS = {
    'aireboot':   lambda: ssh_command('100.100.1.1', 'sudo reboot'),
    'mcreboot':   lambda: ssh_command('100.100.1.2', 'sudo reboot'),
    'aishutdown': lambda: ssh_command('100.100.1.1', 'sudo poweroff'),
    'mcshutdown': lambda: ssh_command('100.100.1.2', 'sudo poweroff'),
    'ai':         lambda: wol('04:7c:16:d7:3c:bf'),
    'mc':         lambda: wol('ec:b1:d7:3e:44:45'),
    'mcips':      lambda: "Tailscale: johnylilmoney.nl | Zerotier: zt.johnylilmoney.nl"
}

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)

@app.route('/api/run/<name>', methods=['POST'])
def run_command(name):
    if name not in COMMANDS:
        return {'error': 'unknown command'}, 404
    
    try:
        result = COMMANDS[name]()
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

def get_server_status(ip, is_mc=False):
    try:
        output = ssh_output(ip, 'uptime')
        if not output:
            status_data = {'status': 'offline', 'uptime': None, 'details': {}}
            if is_mc:
                status_data['details']['Players Online'] = '0'
                status_data['players_list'] = []
            if not is_mc:
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
                count_str = f"{mc_info['online']}/{mc_info['max']}"
                status_data['details']['Players Online'] = count_str
                status_data['players_list'] = mc_info['list']
            else:
                status_data['details']['Players Online'] = '0'
                status_data['players_list'] = []
        else:
            status_data['details'] = {
                'Loaded Model': '--'
            }
            status_data['models_list'] = []

        return status_data

    except Exception:
        status_data = {'status': 'offline', 'uptime': None, 'details': {}}
        if is_mc:
            status_data['details']['Players Online'] = '0'
            status_data['players_list'] = []
        else:
            status_data['details']['Loaded Model'] = '--'
        return status_data

@app.route('/api/status')
def api_status():
    servers = {'ai': ('100.100.1.1', False), 'mc': ('100.100.1.2', True)}
    result = {}
    with ThreadPoolExecutor(max_workers=len(servers)) as executor:
        futures = {
            name: executor.submit(get_server_status, ip, is_mc)
            for name, (ip, is_mc) in servers.items()
        }
        for name, future in futures.items():
            result[name] = future.result()
    return result

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=80)
