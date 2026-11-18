"""Prepare fresh loopback daemon homes. Prints only the directory name."""
import json
import os
from pathlib import Path
import subprocess
import tempfile

os.umask(0o077)
root = Path(tempfile.mkdtemp(prefix="paseo-acl-"))
providers = json.loads((Path.home()/".paseo/config.json").read_text())["agents"]["providers"]
assert providers["claude"]["env"]["ANTHROPIC_BASE_URL"].rstrip("/") == "https://llm.int.exe.xyz"
for port in (7801, 7802):
    home = root / str(port)
    home.mkdir()
    config = {
        "version": 1,
        "daemon": {"listen": f"127.0.0.1:{port}", "relay": {"enabled": False},
                   "mcp": {"enabled": True, "injectIntoAgents": True}},
        "agents": {"providers": providers},
    }
    (home/"config.json").write_text(json.dumps(config)+"\n")
subprocess.run(["git", "init", "-q", str(root/"work")], check=True)
print(root)
