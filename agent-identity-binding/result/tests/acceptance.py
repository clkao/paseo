"""Run one acceptance step in the deployed Linux fixture. All sends go to the broker."""
import json
import os
from pathlib import Path
import shlex
import subprocess
import sys
import time

root = Path(sys.argv[1]).resolve(strict=True)
assert root.parent == Path("/tmp") and root.name.startswith("paseo-broker-")
home = root / "7901"
broker = root / "broker"
endpoint = "127.0.0.1:7900"
cli = "/opt/acl-broker/bin/paseo"
assert json.loads((home / "config.json").read_text())["daemon"]["listen"] == f"unix://{home}/daemon.sock"
env = {k: v for k, v in os.environ.items() if not k.startswith("PASEO_")}
ids_file = broker / "test-ids.json"
ids = json.loads(ids_file.read_text()) if ids_file.exists() else {}

def run(cmd, stdin=None, check=True):
    print("$", shlex.join([str(x) for x in cmd]), flush=True)
    r = subprocess.run(cmd, input=stdin, capture_output=True, text=True, env=env, timeout=100)
    if check and r.returncode:
        raise RuntimeError(f"exit {r.returncode}: {r.stderr or r.stdout}")
    return r

def remember(role, agent_id):
    ids[role] = agent_id
    ids_file.write_text(json.dumps(ids))
    print(role, agent_id, flush=True)

def as_agent(role):
    record = json.loads((broker / "registry.json").read_text())["agents"][ids[role]]
    return ["sudo", "-n", "-H", "-u", record["user"], "--", "/usr/bin/env", "-i",
            "HOME=/home/" + record["user"], "PATH=/opt/acl-broker/bin:/usr/bin:/bin",
            "PASEO_HOST=" + endpoint]

def mcp(role, tool, args, claim=None):
    url = f"http://{endpoint}/mcp/agents"
    if claim:
        url += "?callerAgentId=" + claim
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "tools/call",
                       "params": {"name": tool, "arguments": args}})
    response = run(as_agent(role) + ["curl", "-fsS", "--max-time", "90",
        "-H", "Content-type: application/json", "-H", "Accept: application/json, text/event-stream",
        "--data-binary", body, url]).stdout
    data = next((s[6:] for s in response.splitlines() if s.startswith("data: ")), response)
    if "error" in json.loads(data):
        raise RuntimeError(data)
    result = json.loads(data)["result"]
    print(json.dumps(result), flush=True)
    return result

def cli_send(role, claim, marker, **kwargs):
    return run(as_agent(role) + ["PASEO_AGENT_ID=" + claim, cli, "send", "--json",
               "--no-wait", ids["B"], marker], **kwargs)

def denied(result, reason):
    assert result.get("isError") and reason in result["content"][0]["text"], result

step = sys.argv[2]
if step in ("roots", "destination"):
    for role in (["P", "A"] if step == "roots" else ["R"]):
        if role in ids:
            continue
        r = run([cli, "run", "--home", str(root / "7902" if role == "R" else home), "--new-workspace", "local",
                 "--cwd", (root / "workspace").read_text(), "--no-wait", "--json",
                 "--provider", "codex/gpt-6.2-sol", "--title", "broker-" + role,
                 "Reply READY only. Use no tools."])
        print(r.stdout)
        remember(role, json.loads(r.stdout)["agentId"])
elif step == "child":
    r = mcp("P", "create_agent", {"title": "broker-B", "provider": "codex/gpt-6.2-sol",
        "initialPrompt": "Reply READY only. Use no tools.", "notifyOnFinish": False})
    assert not r.get("isError")
    remember("B", r["structuredContent"]["agentId"])
elif step == "link":
    r = run([cli, "host", "add", "--home", str(home), "--json", "--label", "broker-destination",
             f"unix://{broker}/host.sock"])
    print(r.stdout)
    for _ in range(20):
        hosts = json.loads(run([cli, "host", "ls", "--home", str(home), "--json"]).stdout)
        if any(h["serverId"] == (root / "7902/server-id").read_text().strip()
               and h["status"] == "online" and h["targetDescription"] == f"unix://{broker}/host.sock"
               for h in hosts):
            print("online via", broker / "host.sock")
            break
        time.sleep(1)
    else:
        raise RuntimeError("destination did not come online through the broker link")
elif step == "AC-1":
    marker = "Broker test rejected request"
    r = cli_send("A", ids["P"], marker, check=False)
    print("exit", r.returncode, r.stdout, r.stderr)
    assert r.returncode and "caller identity does not match" in r.stdout + r.stderr
    args = {"agentId": ids["B"], "prompt": marker, "notifyOnFinish": False}
    denied(mcp("A", "send_agent_prompt", args, ids["P"]), "caller identity does not match")
    remote = (root / "7902/server-id").read_text().strip()
    # A host-scoped request must be rejected at ingress before destination lookup.
    denied(mcp("A", "send_agent_prompt", {**args, "agentId": ids["R"], "serverId": remote}, ids["P"]),
           "caller identity does not match")
elif step == "AC-2":
    denied(mcp("A", "send_agent_prompt", {"agentId": ids["B"], "prompt": "Broker deny AC2",
           "notifyOnFinish": False}), "caller did not start")
elif step == "AC-3":
    ports = []
    for unit in (home, root / "7902"):
        status = json.loads(run([cli, "daemon", "status", "--json", "--home", str(unit)]).stdout)
        assert status["listen"] == str(unit / "daemon.sock")
        rows = run(["ss", "-H", "-lntp"]).stdout.splitlines()
        for row in rows:
            if any(f"pid={pid}," in row for pid in (status["workerPid"], status["pid"])):
                address, port = row.split()[3].rsplit(":", 1)
                assert address == "127.0.0.1", row
                ports.append(port)
                print(unit.name, "daemon-owned TCP listener", address, port)
    program = """
import errno, socket, sys
for home in sys.argv[1:3]:
    for name in ('daemon.sock', 'local-credential'):
        path = home + '/' + name
        try:
            if name == 'daemon.sock':
                with socket.socket(socket.AF_UNIX) as s: s.connect(path)
            else:
                with open(path, 'rb') as f: f.read(1)
        except OSError as e:
            print(path, e.errno, e.strerror)
            assert e.errno == errno.EACCES
        else:
            raise AssertionError(path + ' was accessible')
for port in sys.argv[3:]:
    try:
        with socket.create_connection(('127.0.0.1', int(port)), timeout=2): pass
    except ConnectionRefusedError as e:
        print('127.0.0.1', port, e.errno, e.strerror)
    else:
        raise AssertionError('TCP listener was reachable')
"""
    print(run(as_agent("A") + ["python3", "-c", program, str(home), str(root / "7902"), *ports]).stdout)
elif step == "AC-4":
    stamp = time.time_ns()
    def marker(route):
        return f"Reply BROKER_{route}_OK_{stamp} only. Use no tools."
    r = cli_send("P", ids["P"], marker("CLI"))
    print(r.stdout)
    assert json.loads(r.stdout)["status"] in ("queued", "sent")
    r = mcp("P", "send_agent_prompt", {"agentId": ids["B"], "prompt": marker("MCP"),
            "notifyOnFinish": False})
    assert not r.get("isError")
    deadline = time.monotonic() + 100
    while True:
        entries = json.loads(run([cli, "logs", "--home", str(home), "--json", ids["B"]]).stdout)["items"]
        receipts = [e["agentMessage"] for e in entries if e.get("agentMessage")]
        if all(any(m["text"] == marker(route) and m["sender"]["id"] == ids["P"]
                   for m in receipts) for route in ["CLI", "MCP"]):
            print(json.dumps(receipts))
            break
        if time.monotonic() > deadline:
            raise RuntimeError(f"missing child receipt: {receipts}")
        time.sleep(3)
else:
    raise ValueError(step)
print("PASS", "AC-1 enforced denials (3/3)" if step == "AC-1" else step)
