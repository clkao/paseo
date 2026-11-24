import os, pathlib, signal, sys, time
root=pathlib.Path(sys.argv[1]); minimum=None
while not (root/'finished').exists():
    stat=os.statvfs(root); free=stat.f_frsize*stat.f_bavail
    if minimum is None or free < minimum:
        print(time.strftime('%H:%M:%S'),free,'available bytes',flush=True)
        minimum=free
    if free < 1610612736:
        (root/'STOP').touch()
        for proc in pathlib.Path('/proc').glob('[0-9]*/environ'):
            try:
                if any(e.startswith(b'HOME='+os.fsencode(root)+b'/') for e in proc.read_bytes().split(b'\0')):
                    os.kill(int(proc.parent.name),signal.SIGTERM)
            except OSError:
                pass
        break
    time.sleep(1)
