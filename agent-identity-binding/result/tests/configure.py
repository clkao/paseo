"""Write broker configuration after the two isolated daemons have emitted their IDs."""
import json
import os
import sys
from pathlib import Path

os.umask(0o077)
root = Path(sys.argv[1]).resolve(strict=True)
assert root.parent == Path("/tmp") and root.name.startswith("paseo-broker-")
broker = root / "broker"
def daemon(slot):
    home = root / slot
    assert (home / "daemon.sock").is_socket()
    return {"socket": str(home / "daemon.sock"), "serverId": (home / "server-id").read_text().strip()}

local, remote = daemon("7901"), daemon("7902")
config = {"listen": "127.0.0.1:7900", "admin": str(broker / "admin.sock"),
          "state": str(broker / "registry.json"), "grants": str(broker / "grants.json"),
          "log": str(broker / "audit.jsonl"), "daemon": local,
          "pool": [f"acl-ag{i}" for i in range(1, 9)],
          "links": [{"listen": str(broker / "host.sock"), "target": remote["socket"],
                     "serverId": remote["serverId"]}]}
with (broker / "grants.json").open("x") as f:
    json.dump({"grants": []}, f)
(broker / "config.json").write_text(json.dumps(config, indent=2))
