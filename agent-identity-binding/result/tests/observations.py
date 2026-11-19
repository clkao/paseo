"""Read final fixture state without copying credentials or private provider sessions."""
from pathlib import Path
import json
import subprocess
import sys

root = Path(sys.argv[1]).resolve(strict=True)
assert root.parent == Path("/tmp") and root.name.startswith("paseo-broker-")
ids = json.loads((root / "broker/test-ids.json").read_text())
cli = "/opt/acl-broker/bin/paseo"
def query(home, command):
    args = [cli, *command, "--json", "--home", str(home)]
    print("$", *args)
    return json.loads(subprocess.check_output(args, text=True))
source = root / "7901"
dest = root / "7902"
for h in (source, dest):
    s = query(h, ["daemon", "status"])
    print({k:s[k] for k in ("home","serverId","listen","localDaemon","daemonVersion","workerPid")})
for h in query(source, ["host", "ls"]):
    print({k:h[k] for k in ("status", "serverId", "targetDescription")})
    assert h["status"] == "online" and h["targetDescription"] == f"unix://{root}/broker/host.sock"
p = query(source, ["logs", ids["P"]])
tools = [i for i in p["items"] if i.get("name") == "paseo.list_hosts"]
print("P native Codex MCP", [(i["name"],i.get("status")) for i in tools])
assert any(i.get("status") == "completed" for i in tools)
for role,agent_id in ids.items():
    home = dest if role=="R" else source
    (file,) = (home/"agents").rglob(agent_id+".json")
    doc = json.loads(file.read_text())
    print("record", role, {k:doc.get(k) for k in ("id","provider","labels","lastStatus")})
    if role=="B":
        assert doc["labels"]["paseo.parent-agent-id"] == ids["P"]
    if role in ("B","R"):
        events=query(home, ["logs",agent_id])["items"]
        received=[e["agentMessage"] for e in events if e.get("agentMessage")]
        assert all(m["text"] not in ("Broker test rejected request","Broker deny AC2") for m in received)
        print("denied markers received",role,0)
