"""Read the four test records from the designated fixture daemons."""
import json
import os
from pathlib import Path
import shlex
import subprocess
import sys

root = Path(sys.argv[1]).resolve()
assert root.parent == Path("/tmp") and root.name.startswith("paseo-acl-")
parent_id, child_id, independent_id, remote_id = sys.argv[2:]

def query(port, *args):
    home = root / str(port)
    assert json.loads((home / "config.json").read_text())["daemon"]["listen"] == f"127.0.0.1:{port}"
    cmd = ["paseo", *args, "--home", str(home), "--json"]
    print("$", shlex.join(cmd), flush=True)
    return json.loads(subprocess.check_output(cmd, env=dict(os.environ, PASEO_HOME=str(home)), text=True))

for role, port, agent_id, expected_parent in (
    ("P", 7801, parent_id, None),
    ("B", 7801, child_id, parent_id),
    ("A", 7801, independent_id, None),
    ("remote child", 7802, remote_id, parent_id),
):
    record = query(port, "inspect", agent_id)
    print(role, json.dumps({k: record[k] for k in ("Name", "Id", "ParentAgentId", "Status")}))
    assert record["Id"] == agent_id and record["ParentAgentId"] == expected_parent
assert len({parent_id, child_id, independent_id, remote_id}) == 4
events = query(7801, "logs", independent_id)["items"]
replies = [e["text"] for e in events if e["type"] == "assistant_message"]
print("A replies", json.dumps(replies))
assert replies == ["ACL_INDEPENDENT_READY"]
hosts = query(7801, "host", "ls")
(host,) = [h for h in hosts if h["targetDescription"] == "tcp://127.0.0.1:7802"]
print("Saved host", json.dumps({k:host[k] for k in ("targetDescription", "serverId", "status")}))
assert host["status"] == "online"
