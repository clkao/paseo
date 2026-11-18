"""Exercise the genuine parent's normal delegation to its own remote child."""
import json
import os
from pathlib import Path
import subprocess
import sys

root = Path(sys.argv[1]).resolve()
assert root.parent == Path("/tmp") and root.name.startswith("paseo-acl-")
origin, dest = root/"7801", root/"7802"
env = dict(os.environ)
for key in ("PASEO_AGENT_ID", "PASEO_WORKSPACE_ID", "PASEO_AGENT_CWD"):
    env.pop(key, None)

def cli(home, *args):
    assert json.loads((home/"config.json").read_text())["daemon"]["listen"] == f"127.0.0.1:{home.name}"
    return json.loads(subprocess.check_output(["paseo", *args, "--json", "--home", str(home)],
                      text=True, env=dict(env, PASEO_HOME=str(home))))

remote_id = (dest/"server-id").read_text().strip()
(link,) = [h for h in cli(origin, "host", "ls") if h["serverId"] == remote_id]
assert link["status"] == "online" and link["targetDescription"] == "tcp://127.0.0.1:7802"
records = [json.loads(p.read_text()) for p in (origin/"agents").rglob("*.json")]
(parent,) = [a for a in records if a.get("title") == "acl-parent"]
subprocess.run(["git","init","-q",str(root/"dest-work")], check=True)
workspace = cli(dest, "workspace", "create", "--isolation", "local", "--path", str(root/"dest-work"))
print("Destination workspace", workspace)
wid = workspace["workspaceId"]
prompt = (
    f'Use your normal Paseo MCP create_agent tool on server {remote_id}, workspace {wid}, '
    'provider claude/claude-sonnet-5-5, title acl-remote-child, notifyOnFinish false, '
    'initialPrompt "Reply ACL_REMOTE_READY only. Use no tools." After that creation succeeds, call send_agent_prompt once '
    'on the same server to the child ID you just created, with notifyOnFinish false and '
    'prompt "Reply ACL_ROUTED_OK only. Use no tools." Report the results. Use no shell.'
)
print(cli(origin, "send", "--no-wait", parent["id"], prompt))
