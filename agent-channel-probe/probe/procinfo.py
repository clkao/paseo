"""macOS process-tree helpers via libproc (no ps needed)."""
import ctypes, struct, socket
_lp = ctypes.CDLL('/usr/lib/libproc.dylib', use_errno=True)
SOL_LOCAL, LOCAL_PEERPID = 0, 2

def info(pid):
    """Return (ppid, start_sec, comm) or None if unreadable (EPERM / gone)."""
    buf = ctypes.create_string_buffer(136)
    n = _lp.proc_pidinfo(pid, 3, 0, buf, 136)  # PROC_PIDTBSDINFO
    if n != 136:
        return None, ctypes.get_errno()
    b = buf.raw
    return (struct.unpack_from('I', b, 16)[0], struct.unpack_from('Q', b, 120)[0],
            b[48:64].split(b'\0')[0].decode()), 0

def peer_pid(sock):
    return struct.unpack('i', sock.getsockopt(SOL_LOCAL, LOCAL_PEERPID, 4))[0]

def chain(pid, limit=64):
    """Ancestry list of (pid, comm) from pid upward; ends with ('?', errno) if unreadable."""
    out = []
    for _ in range(limit):
        r, err = info(pid)
        if r is None:
            out.append((pid, f'<unreadable errno={err}>'))
            break
        ppid, _, comm = r
        out.append((pid, comm))
        if ppid in (0, pid):
            break
        pid = ppid
    return out
