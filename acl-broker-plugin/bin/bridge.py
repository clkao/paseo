#!/usr/bin/python3
"""Line-delimited MCP over stdio. No daemon credentials or daemon connection."""
import http.client
import json
import socket
import sys

TEXT = {"type": "string"}
TOOLS = [
    ("send_agent_prompt", "Send a prompt to your direct child.", ["agentId", "prompt"],
     {"agentId": TEXT, "prompt": TEXT}),
    ("create_agent", "Start a child in your workspace.", ["provider", "initialPrompt", "title"],
     {"provider": TEXT, "initialPrompt": TEXT, "title": TEXT, "labels": {"type": "object", "additionalProperties": TEXT}}),
    ("list_agents", "List recent agents.", [], {"limit": {"type": "integer", "minimum": 1, "maximum": 200}}),
    ("get_agent_status", "Read the current agent status.", ["agentId"], {"agentId": TEXT}),
]

class Connection(http.client.HTTPConnection):
    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX)
        self.sock.settimeout(95)
        self.sock.connect(sys.argv[1])

def handle(message):
    method = message.get("method")
    if method == "initialize":
        supported = ("2024-11-05", "2025-03-26", "2025-06-18", "2025-11-25")
        version = message.get("params", {}).get("protocolVersion")
        return {"protocolVersion": version if version in supported else supported[-1],
                "capabilities": {"tools": {}}, "serverInfo": {"name": "paseo-acl", "version": "1"}}
    if method == "ping":
        return {}
    if method == "tools/list":
        return {"tools": [{"name": name, "description": desc, "inputSchema": {
            "type": "object", "properties": props, "required": required}}
            for name, desc, required, props in TOOLS]}
    if method != "tools/call":
        raise KeyError(method)
    connection = Connection("localhost")
    try:
        connection.request("POST", "/tool", json.dumps(message["params"]))
        reply = json.load(connection.getresponse())
    except (OSError, ValueError, http.client.HTTPException):
        reply = {"error": "BROKER_UNAVAILABLE"}
    finally:
        connection.close()
    if reply.get("error"):
        return {"isError": True, "content": [{"type": "text", "text": reply["error"]}]}
    return {"structuredContent": reply["result"], "content": [{"type": "text", "text": json.dumps(reply["result"])}]}

def main():
    for line in sys.stdin:
        msg_id = None
        try:
            msg = json.loads(line)
            if "id" not in msg:
                continue
            msg_id = msg["id"]
            answer = {"result": handle(msg)}
        except KeyError:
            answer = {"error": {"code": -32601, "message": "Unknown method or missing field"}}
        except (TypeError, ValueError, AttributeError):
            answer = {"error": {"code": -32600, "message": "Invalid request"}}
        print(json.dumps({"jsonrpc": "2.0", "id": msg_id, **answer}), flush=True)

if __name__ == "__main__":
    main()
