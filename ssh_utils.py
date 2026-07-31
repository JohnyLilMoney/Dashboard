import subprocess

def ssh_command(host, command):
    try:
        result = subprocess.run([...], capture_output=True, timeout=1)
        return result.returncode == 0
    except subprocess.TimeoutExpired:
        return False

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
