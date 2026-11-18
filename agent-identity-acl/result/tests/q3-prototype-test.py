"""Question 3 prototype acceptance test, run against the patched source daemon
(branch acl/agent-identity) on 127.0.0.1:7811.

Rule under test: an agent-attributed directive may target only the agents the
sender started (recipient's paseo.parent-agent-id == sender). Enforced on both
the CLI/WebSocket send path (session.ts) and the agent MCP tool
(send_agent_prompt in paseo-tools.ts).

Fixture (all on 7811): P top-level; B child of P; A top-level (unrelated);
AC child of A.

Cases, each over CLI and over /mcp/agents:
  allow  P  -> B   (B started by P)
  allow  A  -> AC  (AC started by A)        <- "A to its own child allowed"
  REFUSE A  -> B   (honest id A; B not A's) <- the parent rule bites
  note   forge callerAgentId=P -> B         <- self-asserted id still passes;
                                               documents the residual gap
"""
import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

root = Path(sys.argv[1]).resolve()
assert root.name.startswith("paseo-aclp-")
H = root / "7811"
P, B, A, AC = (Path(f"/tmp/qp_{n}").read_text().strip() for n in ("P", "B", "A", "AC"))
names = {P: "P", B: "B", A: "A", AC: "AC"}


def base_env():
    env = dict(os.environ)
    for k in ("PASEO_AGENT_ID", "PASEO_WORKSPACE_ID", "PASEO_AGENT_CWD"):
        env.pop(k, None)
    env["PASEO_HOME"] = str(H)
    return env


def cli_send(sender_id, target_id, text):
    env = base_env()
    env["PASEO_AGENT_ID"] = sender_id  # becomes sourceAgentId
    r = subprocess.run(["paseo", "send", "--home", str(H), "--no-wait", target_id, text],
                       env=env, capture_output=True, text=True, timeout=60)
    ok = r.returncode == 0 and "queued" in (r.stdout + r.stderr).lower()
    return ok, (r.stdout + r.stderr).strip().replace("\n", " ")[:200]


def mcp_send(caller_id, target_id, text):
    url = f"http://127.0.0.1:7811/mcp/agents?callerAgentId={caller_id}"
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "tools/call",
                       "params": {"name": "send_agent_prompt",
                                  "arguments": {"agentId": target_id, "prompt": text,
                                                "notifyOnFinish": False}}}).encode()
    req = urllib.request.Request(url, data=body, headers={
        "Content-Type": "application/json", "Accept": "application/json, text/event-stream"})
    with urllib.request.urlopen(req) as resp:
        raw = resp.read().decode()
    payload = None
    for line in raw.splitlines():
        if line.startswith("data: "):
            payload = json.loads(line[len("data: "):])
    # tool errors come back as result.isError + content text, or a JSON-RPC error
    if payload and "result" in payload:
        res = payload["result"]
        txt = " ".join(c.get("text", "") for c in res.get("content", []))
        ok = not res.get("isError") and '"success": true' in txt
        return ok, txt.replace("\n", " ")[:200]
    return False, json.dumps(payload)[:200]


cases = [
    ("allow", "P->B", P, B),
    ("allow", "A->AC", A, AC),
    ("REFUSE", "A->B (honest)", A, B),
    ("note-forge", "A-as-P->B", P, B),  # caller claims P; B.parent==P so it passes
]

print(f"{'case':14} {'transport':5} {'expect':11} {'result':8} detail")
for expect, label, sender, target in cases:
    for transport, fn in (("cli", cli_send), ("mcp", mcp_send)):
        ok, detail = fn(sender, target, f"Reply Q3_{label.split()[0]}_OK only. Use no tools.")
        verdict = "ACCEPTED" if ok else "REFUSED"
        print(f"{label:14} {transport:5} {expect:11} {verdict:8} {detail}")
