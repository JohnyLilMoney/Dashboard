import subprocess

def ssh_command(ip):
    cmd = [
        'ssh',
        '-o', 'ConnectTimeout=1',
        '-o', 'ConnectionAttempts=1',
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
        '-o', 'GSSAPIAuthentication=no',
        '-o', 'KbdInteractiveAuthentication=no',
        '-o', 'BatchMode=yes',
        '-o', 'UseDNS=no',
        ip, 'uptime'
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=1)
        if result.returncode == 0:
            return result.stdout.strip()
        else:
            return {"error": f"SSH failed (code {result.returncode})"}
    except subprocess.TimeoutExpired:
        return {"error": "SSH timed out"}
    except Exception as e:
        return {"error": str(e)}

def ssh_output(host, command):
    try:
        result = subprocess.run(
            ['ssh', '-i', '/home/johny/.ssh/webdash',
                   '-o', 'ConnectTimeout=1',
                   '-o', 'BatchMode=yes',
                   '-o', 'StrictHostKeyChecking=no',
                   f'remoteadmin@{host}', command],
            capture_output=True,
            text=True,
            timeout=1
        )
        if result.returncode == 0:
            return result.stdout
        return None
    except subprocess.TimeoutExpired:
        return None
