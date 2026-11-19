// One instance owns one listener. Only the private pipes reach the broker.
const http = require("node:http");
const { connect } = require("node:net");
const { createInterface } = require("node:readline");
const { WebSocketServer } = require("ws");

const limit = 128 * 1024;
const tools = new Set(["create_agent", "list_agents", "get_agent_status", "send_agent_prompt"]);

function listen(socket, call, ready) {
  const server = http.createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/tool") return res.writeHead(404).end();
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > limit) return res.writeHead(413).end();
        chunks.push(chunk);
      }
      const { name, arguments: args } = JSON.parse(Buffer.concat(chunks));
      if (!tools.has(name)) return res.writeHead(400).end();
      const { result, error } = await call(name, args);
      res
        .writeHead(200, { "Content-Type": "application/json" })
        .end(JSON.stringify({ result, error }));
    } catch {
      res.writeHead(400).end();
    }
  });

  // The bubblewrap stand-in has private networking. Its HTTPS proxy may tunnel
  // TLS only to this VM's model gateway. This route has no daemon transport.
  server.on("connect", (req, client, head) => {
    if (req.url !== "llm.int.exe.xyz:443") return client.destroy();
    const upstream = connect(443, "llm.int.exe.xyz", () => {
      client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length) upstream.write(head);
      upstream.pipe(client).pipe(upstream);
    });
    upstream.on("error", () => client.destroy());
    client.on("error", () => upstream.destroy());
    client.on("close", () => upstream.destroy());
  });

  const ws = new WebSocketServer({ server, path: "/ws", maxPayload: limit });
  ws.on("connection", (client) => {
    let ready = false;
    function session(type, payload) {
      if (client.readyState === client.OPEN)
        client.send(JSON.stringify({ type: "session", message: { type, payload } }));
    }
    client.on("error", () => client.terminate());
    client.on("message", async (raw, binary) => {
      try {
        if (binary) return client.close(1003);
        const frame = JSON.parse(raw);
        if (!ready && frame.type === "hello") {
          ready = true;
          return session("status", {
            status: "server_info",
            serverId: "paseo-acl",
            hostname: null,
            version: null,
            features: { agentMessageProvenance: true },
          });
        }
        if (ready && frame.type === "ping") return client.send(JSON.stringify({ type: "pong" }));
        if (!ready || frame.type !== "session") return client.close(1002);
        const m = frame.message;
        if (typeof m.requestId !== "string") return client.close(1002);
        if (m.type === "send_agent_message_request") {
          if (m.images?.length || m.attachments?.length || m.sessionMode || m.sourceAgentServerId) {
            return session("send_agent_message_response", {
              requestId: m.requestId,
              agentId: m.agentId,
              accepted: false,
              error: "UNSUPPORTED_ARGUMENT",
            });
          }
          const { error } = await call("send_agent_prompt", { agentId: m.agentId, prompt: m.text });
          return session("send_agent_message_response", {
            requestId: m.requestId,
            agentId: m.agentId,
            accepted: !error,
            error: error || null,
          });
        }
        if (m.type === "wait_for_finish_request") {
          const { result, error } = await call("wait_for_finish", {
            agentId: m.agentId,
            timeoutMs: m.timeoutMs,
          });
          if (!error)
            return session("wait_for_finish_response", { ...result, requestId: m.requestId });
          return session("rpc_error", { requestId: m.requestId, error, code: error });
        }
        session("rpc_error", {
          requestId: m.requestId,
          requestType: m.type,
          error: "UNSUPPORTED_OPERATION",
          code: "UNSUPPORTED_OPERATION",
        });
      } catch {
        client.close(1002);
      }
    });
  });
  return server.listen(socket, ready);
}

function start(socket) {
  const pending = new Map();
  let token;
  let next = 0;
  function call(operation, args) {
    if (pending.size >= 32) return Promise.resolve({ error: "BUSY" });
    const seq = ++next;
    return new Promise((resolve) => {
      const timeout = setTimeout(
        () => {
          pending.delete(seq);
          resolve({ error: "OUTCOME_UNKNOWN" });
        },
        operation === "wait_for_finish" ? (args.timeoutMs || 600000) + 5000 : 90000,
      );
      pending.set(seq, (reply) => {
        clearTimeout(timeout);
        resolve(reply);
      });
      process.stdout.write(JSON.stringify({ token, operation, args, seq }) + "\n");
    });
  }

  const input = createInterface({ input: process.stdin });
  input.on("line", (line) => {
    const frame = JSON.parse(line);
    if (!token) {
      if (!/^pacl_v1_[a-f0-9]{64}$/.test(frame.token)) process.exit(1);
      token = frame.token;
      listen(socket, call, () => process.stdout.write("ready\n"));
    } else {
      const resolve = pending.get(frame.seq);
      pending.delete(frame.seq);
      resolve?.(frame);
    }
  });
  input.on("close", () => process.exit(0));
}

if (require.main === module) start(process.argv[2]);
module.exports = { listen };
