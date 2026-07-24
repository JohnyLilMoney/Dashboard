import subprocess

def ssh_command(host, command):
    result = subprocess.run(
        ['ssh', '-i', '/home/johny/.ssh/webdash',
               '-o', 'ConnectTimeout=1',
               '-o', 'BatchMode=yes',
               '-o', 'StrictHostKeyChecking=no',
               f'remoteadmin@{host}', command],
        capture_output=True
    )
    return result.returncode == 0

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
