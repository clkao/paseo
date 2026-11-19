"""Create two private, socket-only Paseo homes and an operator-owned workspace."""
import json
import os
import tempfile
import tomllib
from pathlib import Path

BROKER_DIR = Path(__file__).resolve().parent.parent
os.umask(0o077)
root = Path(tempfile.mkdtemp(prefix="paseo-broker-"))
(root / "broker").mkdir()
work = Path(tempfile.mkdtemp(prefix="paseo-codex-work-"))
work.chmod(0o755)  # agents can enter, only the operator can change workspace setup
(root / "workspace").write_text(str(work))
settings = json.loads((Path.home() / ".paseo/config.json").read_text())
native = tomllib.loads((Path.home() / ".codex/config.toml").read_text())
gateway = native["model_providers"][native["model_provider"]]
assert gateway["base_url"] == "https://llm.int.exe.xyz/openai/v1"
assert gateway["wire_api"] == "responses" and gateway["requires_openai_auth"] is False
for slot in ("7901", "7902"):
    home = root / slot
    home.mkdir()
    provider = dict(settings["agents"]["providers"]["codex"])
    provider.update(command=[str(BROKER_DIR / "bin/agent-launch")], env={
        "ACL_BROKER_ADMIN": str(root / "broker/admin.sock"),
        "ACL_BROKER_REGISTRATION_PATH": "/destination" if slot == "7902" else "",
        "ACL_BROKER_URL": "127.0.0.1:7900",
        "ACL_CODEX_GATEWAY": gateway["base_url"], "ACL_CODEX_MODEL": native["model"],
    })
    config = {"version": 1, "daemon": {
        "listen": f"unix://{home}/daemon.sock", "relay": {"enabled": False},
        # A Unix listener has no injectable HTTP URL. Enable the scoped MCP
        # catalog; Codex has no native Paseo tool bridge.
        "mcp": {"enabled": True, "injectIntoAgents": True},
    }, "agents": {"providers": {"codex": provider}}}
    (home / "config.json").write_text(json.dumps(config, indent=2))
print(root)
