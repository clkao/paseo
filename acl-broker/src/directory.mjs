// Reads agent records from the daemon for policy decisions. The broker talks
// to the daemon's /mcp/agents on its Unix socket with no callerAgentId, so the
// lookup is the operator's view. Routed lookups pass serverId and travel over
// the connected-host link like any routed tool call.
import { request as httpRequest } from "node:http";

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export class DaemonDirectory {
  constructor({ socket, localServerId, log }) {
    this.socket = socket;
    this.localServerId = localServerId;
    this.log = log;
  }

  callTool(name, args) {
    const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } });
    return new Promise((resolve, reject) => {
      const req = httpRequest(
        {
          socketPath: this.socket,
          path: "/mcp/agents",
          method: "POST",
          headers: {
            host: "localhost",
            "content-type": "application/json",
            accept: "application/json, text/event-stream",
            "content-length": Buffer.byteLength(body),
          },
        },
        (res) => {
          let raw = "";
          res.on("data", (c) => (raw += c));
          res.on("end", () => {
            const line = raw.split("\n").find((l) => l.startsWith("data: "));
            try {
              resolve(JSON.parse(line ? line.slice(6) : raw));
            } catch (err) {
              reject(new Error(`directory: bad response ${raw.slice(0, 200)}`));
            }
          });
        },
      );
      req.on("error", reject);
      req.end(body);
    });
  }

  /** Returns { id, serverId, labels, cwd, workspaceId, parentAgentId, parentServerId } or null. */
  async getAgent(agentId, serverId) {
    if (!UUID.test(agentId ?? "")) return null;
    const remote = serverId && serverId !== this.localServerId;
    const args = remote ? { agentId, serverId } : { agentId };
    const resp = await this.callTool("get_agent_status", args);
    const sc = resp?.result?.structuredContent;
    const snap = sc?.snapshot ?? sc?.result?.snapshot ?? null;
    if (!snap || resp?.result?.isError) {
      this.log("directory_miss", { agentId, serverId: serverId ?? null, resp: JSON.stringify(resp).slice(0, 300) });
      return null;
    }
    const labels = snap.labels ?? {};
    return {
      id: snap.id ?? agentId,
      serverId: remote ? serverId : this.localServerId,
      labels,
      cwd: snap.cwd ?? null,
      workspaceId: snap.workspaceId ?? null,
      projectId: snap.projectId ?? null,
      parentAgentId: labels["paseo.parent-agent-id"] ?? null,
      // A record without a parent server id has its parent on its own daemon.
      parentServerId: labels["paseo.parent-server-id"] ?? (remote ? serverId : this.localServerId),
    };
  }
}

export { UUID };
