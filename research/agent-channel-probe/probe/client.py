"""Probe client: tries fd 3 (inherited socketpair) and the named socket. Prints one line per channel."""
import os, sys, socket, stat, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def try_fd3(label):
    fd = int(os.environ.get('PASEO_AGENT_FD', '3'))
    try:
        st = os.fstat(fd)
    except OSError as e:
        return f'fd{fd}: absent ({e.strerror})'
    if not stat.S_ISSOCK(st.st_mode):
        return f'fd{fd}: present but not a socket (mode={oct(st.st_mode)})'
    try:
        s = socket.socket(fileno=os.dup(fd))
        s.settimeout(3)
        s.sendall(f'{label} pid={os.getpid()}\n'.encode())
        return f'fd{fd}: reply={s.recv(200).decode().strip()!r}'
    except OSError as e:
        return f'fd{fd}: socket error ({e})'

def try_named(label):
    path = os.environ.get('PASEO_AGENT_SOCK', '/tmp/agent-channel-probe/d.sock')
    try:
        s = socket.socket(socket.AF_UNIX); s.settimeout(3); s.connect(path)
        s.sendall(f'{label} pid={os.getpid()}\n'.encode())
        return f'named: reply={s.recv(200).decode().strip()!r}'
    except OSError as e:
        return f'named: error ({e})'

def probe(label):
    line = f'[{label}] pid={os.getpid()} ppid={os.getppid()} | {try_fd3(label)} | {try_named(label)}'
    print(line, flush=True)
    out = os.environ.get('PROBE_CLIENT_LOG')
    for path in filter(None, [out, os.environ.get('PROBE_CLIENT_LOG2')]):
        try:
            with open(path, 'a') as f: f.write(line + '\n')
        except OSError as e:
            print(f'(could not write {path}: {e})', file=sys.stderr)

def escapes(prefix):
    """setsid child (parent alive), setsid orphan, double fork orphan. nohup is done from the shell."""
    # 1. setsid while parent alive
    if os.fork() == 0:
        os.setsid(); probe(f'{prefix}-setsid-parent-alive'); os._exit(0)
    os.wait()
    # 2. setsid child that outlives this process (reparented to launchd)
    if os.fork() == 0:
        os.setsid(); time.sleep(2); probe(f'{prefix}-setsid-orphan'); os._exit(0)
    # 3. classic double fork
    if os.fork() == 0:
        if os.fork() == 0:
            os.setsid(); time.sleep(2); probe(f'{prefix}-doublefork'); os._exit(0)
        os._exit(0)
    os.wait()
    probe(f'{prefix}-direct')

if __name__ == '__main__':
    label = sys.argv[1] if len(sys.argv) > 1 else 'client'
    if len(sys.argv) > 2 and sys.argv[2] == 'escapes':
        escapes(label)
    elif len(sys.argv) > 2 and sys.argv[2] == 'loop':
        for i in range(int(sys.argv[3])):
            probe(f'{label}-tick{i}'); time.sleep(1)
    else:
        probe(label)
