"""Stand-in for the Paseo daemon.

Starts an agent command with one end of a socketpair as fd 3 (PASEO_AGENT_FD=3) and
listens on a named Unix socket (PASEO_AGENT_SOCK). On the named socket, it reads the
peer PID (LOCAL_PEERPID) and accepts only if the agent root PID (with matching start
time) is in the peer's ancestry.

usage: harness.py --log F [--sock P] [--state F] [--grace S] [--runs N] [--sibling]
                  [--detach-after S] -- cmd...
       harness.py --log F --adopt STATE --duration S        (daemon-restart mode)
"""
import argparse, json, os, socket, subprocess, sys, threading, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import procinfo

HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument('--log', required=True)
ap.add_argument('--sock', default='/tmp/agent-channel-probe/d.sock')
ap.add_argument('--state', default='/tmp/agent-channel-probe/state.json')
ap.add_argument('--grace', type=float, default=6)
ap.add_argument('--runs', type=int, default=1)
ap.add_argument('--sibling', action='store_true')
ap.add_argument('--detach-after', type=float)
ap.add_argument('--adopt')
ap.add_argument('--duration', type=float, default=8)
ap.add_argument('--client-log', help='exported as PROBE_CLIENT_LOG so clients also write their own view')
ap.add_argument('cmd', nargs='*')
a = ap.parse_args()

lock = threading.Lock()
def log(msg):
    line = f'{time.strftime("%H:%M:%S")} {msg}'
    with lock:
        with open(a.log, 'a') as f: f.write(line + '\n')
        print(line, file=sys.stderr, flush=True)

root = {'pid': None, 'start': None}

def verdict(pid):
    ch = procinfo.chain(pid)
    pids = [p for p, _ in ch]
    ok = False
    if root['pid'] in pids:
        r, _ = procinfo.info(root['pid'])
        ok = r is not None and r[1] == root['start']  # guards PID reuse
    return ok, ' <- '.join(f'{p}:{c}' for p, c in ch)

def serve_named():
    try: os.unlink(a.sock)
    except FileNotFoundError: pass
    srv = socket.socket(socket.AF_UNIX)
    try:
        srv.bind(a.sock); os.chmod(a.sock, 0o600); srv.listen(16)
    except OSError as e:
        log(f'NAMED bind/listen FAILED {a.sock}: {e}'); return
    log(f'NAMED listening {a.sock}')
    while True:
        c, _ = srv.accept()
        threading.Thread(target=handle_named, args=(c,), daemon=True).start()

def handle_named(c):
    with c:
        pid = procinfo.peer_pid(c)
        ok, ch = verdict(pid)
        c.settimeout(3)
        try: msg = c.recv(200).decode().strip()
        except OSError: msg = '<no msg>'
        log(f'NAMED {"ACCEPT" if ok else "REFUSE"} peer={pid} msg={msg!r} chain={ch}')
        try: c.sendall(b'ACCEPT\n' if ok else b'REFUSE\n')
        except OSError: pass

def serve_pair(s, gen):
    buf = b''
    while True:
        try: d = s.recv(4096)
        except OSError: break
        if not d: break
        buf += d
        while b'\n' in buf:
            line, buf = buf.split(b'\n', 1)
            log(f'PAIR[agent#{gen}] msg={line.decode()!r}')
            try: s.sendall(f'ok-pair-agent#{gen}\n'.encode())
            except OSError: pass
    log(f'PAIR[agent#{gen}] closed by peer side')

def spawn(gen):
    parent, child = socket.socketpair()
    cfd = child.fileno()
    env = dict(os.environ, PASEO_AGENT_FD='3', PASEO_AGENT_SOCK=a.sock)
    if a.client_log: env['PROBE_CLIENT_LOG'] = a.client_log
    def pre():
        os.dup2(cfd, 3)
        if cfd != 3: os.close(cfd)
    p = subprocess.Popen(a.cmd, env=env, pass_fds=(3, cfd), preexec_fn=pre)
    child.close()
    r, _ = procinfo.info(p.pid)
    root.update(pid=p.pid, start=r[1] if r else None)
    with open(a.state, 'w') as f: json.dump(root, f)
    log(f'SPAWN agent#{gen} pid={p.pid} start={root["start"]} cmd={a.cmd!r}')
    threading.Thread(target=serve_pair, args=(parent, gen), daemon=True).start()
    return p, parent

if a.adopt:
    root.update(json.load(open(a.adopt)))
    r, err = procinfo.info(root['pid'])
    log(f'ADOPT root={root} alive_and_same={bool(r and r[1]==root["start"])} (err={err})')
    threading.Thread(target=serve_named, daemon=True).start()
    time.sleep(a.duration); log('HARNESS exit (adopt)'); os._exit(0)

threading.Thread(target=serve_named, daemon=True).start()
time.sleep(0.2)
for gen in range(1, a.runs + 1):
    p, parent = spawn(gen)
    if a.sibling:
        time.sleep(0.5)
        env = dict(os.environ, PASEO_AGENT_SOCK=a.sock)
        if a.client_log: env['PROBE_CLIENT_LOG'] = a.client_log
        subprocess.run([sys.executable, '-I', f'{HERE}/client.py', f'sibling-of-agent#{gen}'], env=env)
    if a.detach_after:
        time.sleep(a.detach_after)
        log('HARNESS exit without stopping agent (daemon crash)'); os._exit(0)
    rc = p.wait()
    log(f'EXIT agent#{gen} rc={rc}; closing its pair end')
    parent.close()  # daemon policy: a dead agent's pair end is closed
log(f'GRACE {a.grace}s for late/escaped clients')
time.sleep(a.grace)
log('HARNESS exit')
