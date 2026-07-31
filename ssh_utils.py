import subprocess

def ssh_command(host, command):
    try:
        result = subprocess.run([...], capture_output=True, timeout=1)
        return result.returncode == 0
    except subprocess.TimeoutExpired:
        return False

def ssh_output(host, command):
    cmd = [
        'ssh', '-i', '/home/johny/.ssh/webdash',
        '-o', 'ConnectTimeout=1',
        '-o', 'BatchMode=yes',
        '-o', 'StrictHostKeyChecking=no',
        f'remoteadmin@{host}', command
    ]
    
    try:
        with subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True) as proc:
            try:
                stdout, _ = proc.communicate(timeout=1.1)
                if proc.returncode == 0:
                    return stdout
                return None
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.communicate() 
                return None
    except Exception:
        return None
