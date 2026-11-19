"""Limit the fixture accounts' loopback TCP access to the broker (requires nft)."""
from pathlib import Path
import pwd
import re
import subprocess
import sys

root = Path(sys.argv[1]).resolve(strict=True)
match = re.fullmatch(r"paseo-broker-([a-z0-9_]+)", root.name)
assert root.parent == Path("/tmp") and match
assert root.stat().st_mode & 0o077 == 0
table = "paseo_broker_" + match[1]
users = ["acl-probe", *(f"acl-ag{i}" for i in range(1, 9))]
uids = [pwd.getpwnam(u).pw_uid for u in users]
assert min(uids) > 0 and len(set(uids)) == len(uids)
cmd = ["sudo", "-n", "nft"]
if sys.argv[2] == "install":
    # One transaction; never flush or replace another table. The installed
    # Paseo starts a loopback OpenCode bridge even in a Codex-only fixture.
    rules = f"""
create table inet {table}
add chain inet {table} output {{ type filter hook output priority filter; policy accept; }}
add rule inet {table} output oifname "lo" meta skuid {{ {', '.join(map(str,uids))} }} tcp dport != 7900 counter reject with tcp reset
"""
    subprocess.run([*cmd, "-f", "-"], input=rules, text=True, check=True)
    print(rules.strip())
elif sys.argv[2] == "remove":
    subprocess.run([*cmd, "delete", "table", "inet", table], check=True)
    print("removed", table)
else:
    raise ValueError(sys.argv[2])
