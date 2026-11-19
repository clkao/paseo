"""Collect the isolated positive controls and the CLI session-binding observation as JSONL."""
import json
import os
from pathlib import Path
import subprocess
import sys
from urllib.parse import parse_qs, urlsplit

root = Path(sys.argv[1]).resolve()
assert root.parent == Path("/tmp") and root.name.startswith("paseo-acl-")
env = dict(os.environ)
for name in ("PASEO_AGENT_ID", "PASEO_AGENT_CWD", "PASEO_WORKSPACE_ID"):
    env.pop(name, None)

def emit(name, data):
    print(json.dumps({"observation": name, "data": data}))

def fields(row, names):
    return {k: row[k] for k in names.split() if k in row}

def cli(port, *args):
    home = str(root/str(port))
    return json.loads(subprocess.check_output(
        ["paseo", *args, "--home", home, "--json"], text=True, env=dict(env, PASEO_HOME=home)))

def record(port, title):
    home = root/str(port)
    config = json.loads((home/"config.json").read_text())
    assert config["daemon"]["listen"] == f"127.0.0.1:{port}"
    records = (json.loads(f.read_text()) for f in (home/"agents").rglob("*.json"))
    (a,) = [a for a in records if a.get("title") == title]
    emit(f"{port} stored agent", fields(a, "id title provider labels workspaceId lastStatus"))
    return a

parent = record(7801, "acl-parent")
local = record(7801, "acl-own-child")
remote = record(7802, "acl-remote-child")
origin_id = (root/"7801/server-id").read_text().strip()
dest_id = (root/"7802/server-id").read_text().strip()
assert local["labels"]["paseo.parent-agent-id"] == remote["labels"]["paseo.parent-agent-id"] == parent["id"]
assert remote["labels"]["paseo.parent-server-id"] == origin_id
(host,) = [h for h in cli(7801, "host", "ls") if h["serverId"] == dest_id]
emit("7801 host ls", fields(host, "registrationId serverId label status targetDescription"))
assert host["status"] == "online" and host["targetDescription"] == "tcp://127.0.0.1:7802"

for item in cli(7801, "logs", parent["id"])["items"]:
    name = item.get("name", "")
    if name.startswith("mcp__paseo__") or name == "Bash":
        emit("7801 parent tool", fields(item, "name status error detail"))

for port, agent, markers in [(7801, local, ["ACL_CLI_OK","ACL_MCP_OK"]), (7802, remote, ["ACL_ROUTED_OK"])]:
    seen_messages, replies = set(), set()
    for item in cli(port, "logs", agent["id"])["items"]:
        if message := item.get("agentMessage"):
            emit(f"{port} received", {"messageId": item["callId"], **message})
            assert message["sender"]["id"] == parent["id"]
            if port == 7802:
                assert message["sender"]["serverId"] == origin_id
            seen_messages.add(message["text"])
        if item["type"] == "assistant_message":
            replies.add(item["text"].strip())
            emit(f"{port} child reply", item["text"])
    for marker in markers:
        assert f"Reply {marker} only. Use no tools." in seen_messages and marker in replies

creates = {}
caller_url_observed = False
for port in (7801, 7802):
    for line in (root/str(port)/"daemon.log").read_text().splitlines():
        if not line.startswith("{"):
            continue
        r = json.loads(line)
        if r.get("msg") == "Created agent" and r.get("agentId") in (parent["id"],local["id"],remote["id"]):
            emit(f"{port} daemon", fields(r,"time msg agentId clientId sessionId daemonVersion"))
            creates[r["agentId"]] = r
        if r.get("msg") == "Agent MCP request" and r.get("body",{}).get("method") == "tools/call":
            u = urlsplit(r["url"])
            assert u.path == "/mcp/agents" and parse_qs(u.query).get("callerAgentId") == [parent["id"]]
            emit(f"{port} daemon", fields(r,"time msg method url body daemonVersion"))
            caller_url_observed = True
assert caller_url_observed
for field in ("clientId", "sessionId"):
    emit("operator CLI and parent CLI same " + field, creates[parent["id"]][field] == creates[local["id"]][field])
