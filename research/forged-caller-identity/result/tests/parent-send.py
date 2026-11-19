"""Ask the genuine test parent to send two markers to its own child."""
import json
import os
from pathlib import Path
import subprocess
import sys

root = Path(sys.argv[1]).resolve()
assert root.parent == Path("/tmp") and root.name.startswith("paseo-acl-")
home = root / "7801"
assert json.loads((home/"config.json").read_text())["daemon"]["listen"] == "127.0.0.1:7801"
records = [json.loads(p.read_text()) for p in (home/"agents").rglob("*.json")]
(parent,) = [a for a in records if a.get("title") == "acl-parent"]
(child,) = [a for a in records if a.get("title") == "acl-own-child" and
            a["labels"].get("paseo.parent-agent-id") == parent["id"]]
env = dict(os.environ, PASEO_HOME=str(home))
for name in ("PASEO_AGENT_ID", "PASEO_AGENT_CWD", "PASEO_WORKSPACE_ID"):
    env.pop(name, None)
prompt = (
    f'Your test child has ID {child["id"]}. In your shell, run exactly this command once: '
    f'paseo send --home {home} --no-wait {child["id"]} "Reply ACL_CLI_OK only. Use no tools." '
    f'Then use the normal Paseo MCP send_agent_prompt tool once to the same child, with '
    f'prompt "Reply ACL_MCP_OK only. Use no tools." and notifyOnFinish false. '
    f'Report the receipts. Use your ordinary identity throughout.'
)
subprocess.run(["paseo", "send", "--home", str(home), "--no-wait", parent["id"], prompt],
               env=env, check=True)
