#!/usr/bin/env node
// acl-broker: the only route from an agent to a Paseo daemon.
//
// Identity: every agent runs as its own OS user (bin/agent-launch). The broker
// accepts agent connections on loopback TCP and reads the uid of the client
// socket from /proc/net/tcp. That uid maps to exactly one agent id, which the
// launcher registered over the admin socket before the agent started. The
// agent sends no identity claim; any it sends is overwritten.
//
// Authorization: see policy.mjs. Rule 1: an agent may direct only the agents
// it started. Grants (grants.json) add host, agent, workspace and tool access.

import { createServer as createHttpServer, request as httpRequest } from "node:http";
import { createServer as createNetServer, connect as netConnect } from "node:net";
import { readFileSync, writeFileSync, existsSync, unlinkSync, chmodSync, appendFileSync, renameSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { WebSocketServer, WebSocket } from "ws";
import { Policy, identityConflict } from "./policy.mjs";
import { peerUid } from "./peer.mjs";
import { DaemonDirectory } from "./directory.mjs";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i].replace(/^--/, "");
    out[k] = argv[i + 1];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const config = JSON.parse(readFileSync(args.config, "utf8"));
process.umask(0o077);
if (!/^127\.0\.0\.1:\d+$/.test(config.listen)) throw new Error("loopback listener required");

function log(event, data = {}) {
  const line = JSON.stringify({ t: new Date().toISOString(), event, ...data });
  appendFileSync(config.log, line + "\n");
}

// ---------- agent registry (agent id <-> OS user) ----------
const state = existsSync(config.state)
  ? JSON.parse(readFileSync(config.state, "utf8"))
  : { agents: {} };
function saveState() {
  writeFileSync(config.state + ".tmp", JSON.stringify(state, null, 1) + "\n", { mode: 0o600 });
  renameSync(config.state + ".tmp", config.state);
}
const uidOfUser = new Map();
for (const user of config.pool) {
  uidOfUser.set(user, Number(execFileSync("id", ["-u", user], { encoding: "utf8" }).trim()));
}
function agentForUid(uid) {
  for (const [agentId, rec] of Object.entries(state.agents)) {
    if (rec.uid === uid) return agentId;
  }
  return null;
}
function register(agentId) {
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(agentId)) {
    throw new Error("agentId must be a UUID");
  }
  const existing = state.agents[agentId];
  if (existing) return existing;
  const used = new Set(Object.values(state.agents).map((r) => r.user));
  const user = config.pool.find((u) => !used.has(u));
  if (!user) throw new Error("agent OS user pool exhausted");
  const rec = { user, uid: uidOfUser.get(user), registeredAt: new Date().toISOString() };
  state.agents[agentId] = rec;
  saveState();
  log("register", { agentId, ...rec });
  return rec;
}

// ---------- admin socket (daemon OS user only) ----------
if (existsSync(config.admin)) unlinkSync(config.admin);
const admin = createHttpServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    try {
      if (req.method === "POST" && req.url === "/register") {
        const { agentId } = JSON.parse(body);
        const rec = register(agentId);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ agentId, user: rec.user }));
        return;
      }
      if (req.method === "GET" && req.url === "/agents") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(state.agents));
        return;
      }
      res.writeHead(404).end();
    } catch (err) {
      log("admin_error", { error: String(err) });
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: String(err.message ?? err) }));
    }
  });
});
admin.listen(config.admin, () => chmodSync(config.admin, 0o600));

// ---------- policy ----------
const directory = new DaemonDirectory({ socket: config.daemon.socket, localServerId: config.daemon.serverId, log });
const policy = new Policy({ grantsPath: config.grants, directory, localServerId: config.daemon.serverId, log });

// ---------- agent ingress ----------
function identify(socket) {
  const uid = peerUid(socket);
  const agentId = uid === null ? null : agentForUid(uid);
  return { uid, agentId };
}

function sendJson(res, status, obj) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(obj));
}

function mcpDenied(id, message) {
  // A tool result with isError so the model sees the reason.
  return {
    jsonrpc: "2.0",
    id,
    result: { content: [{ type: "text", text: `acl-broker refused: ${message}` }], isError: true },
  };
}

async function handleMcp(req, res, caller) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 1024 * 1024) return sendJson(res, 413, { error: "request too large" });
    chunks.push(c);
  }
  let body;
  try { body = JSON.parse(Buffer.concat(chunks)); }
  catch { return sendJson(res, 400, { error: "invalid JSON" }); }
  if (!body || body.jsonrpc !== "2.0" || Array.isArray(body)) {
    return sendJson(res, 400, { error: "expected a single JSON-RPC request" });
  }
  const url = new URL(req.url, "http://broker");
  const identity = caller.agentId;
  const argsIn = body.params?.arguments ?? {};
  const claims = ["callerAgentId", "sourceAgentId"].flatMap(k => [
    ...url.searchParams.getAll(k), ...(Object.hasOwn(argsIn, k) ? [argsIn[k]] : [])
  ]);
  let decision;
  if (identityConflict(identity, claims) || Object.hasOwn(argsIn, "sourceAgentServerId")) {
    decision = { allow: false, rule: "identity", reason: "caller identity does not match the connection" };
  } else if (body.method === "tools/call") {
    if (!argsIn || typeof argsIn !== "object" || Array.isArray(argsIn)) {
      return sendJson(res, 400, { error: "invalid tool arguments" });
    }
    delete argsIn.callerAgentId;
    delete argsIn.sourceAgentId;
    decision = await policy.decideMcp(identity, body.params.name, argsIn);
    body = { jsonrpc: "2.0", id: body.id, method: "tools/call",
      params: { name: body.params.name, arguments: argsIn } };
  } else if (!["initialize", "notifications/initialized", "tools/list", "ping"].includes(body.method)) {
    decision = { allow: false, rule: "method", reason: "method is unavailable" };
  }
  if (decision) {
    log("mcp", { caller: identity, uid: caller.uid, tool: body.params?.name,
      target: argsIn.agentId, host: argsIn.serverId, ...decision });
    if (!decision.allow) return sendJson(res, 200, mcpDenied(body.id, decision.reason));
  }
  const path = `/mcp/agents?callerAgentId=${encodeURIComponent(identity)}`;
  const raw = JSON.stringify(body);
  const headers = { "content-type": "application/json", accept: "application/json, text/event-stream",
    "content-length": Buffer.byteLength(raw) };
  const up = httpRequest(
    { socketPath: config.daemon.socket, path, method: "POST", headers: { ...headers, host: "localhost" } },
    (upRes) => {
      res.writeHead(upRes.statusCode ?? 502, upRes.headers);
      upRes.pipe(res);
    },
  );
  up.on("error", (err) => sendJson(res, 502, { error: String(err) }));
  up.end(raw);
}

const ingress = createHttpServer((req, res) => {
  const caller = identify(req.socket);
  if (!caller.agentId) {
    log("refuse_unknown_peer", { uid: caller.uid, url: req.url });
    return sendJson(res, 403, { error: `acl-broker: uid ${caller.uid} is not a registered agent` });
  }
  const path = req.url?.split("?")[0];
  if (path === "/mcp/agents" && req.method === "POST") {
    handleMcp(req, res, caller).catch((err) => {
      log("mcp_error", { error: String(err?.stack ?? err) });
      if (!res.headersSent) sendJson(res, 500, { error: "broker error" });
    });
    return;
  }
  if (path === "/mcp/agents") {
    return sendJson(res, 405, { jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed" }, id: null });
  }
  if (path === "/api/health" && req.method === "GET") {
    return sendJson(res, 200, { status: "ok", via: "acl-broker" });
  }
  log("refuse_path", { caller: caller.agentId, path, method: req.method });
  sendJson(res, 403, { error: `acl-broker: ${req.method} ${path} is not routed to agents` });
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });
ingress.on("upgrade", (req, socket, head) => {
  const caller = identify(socket);
  const path = req.url?.split("?")[0];
  if (!caller.agentId || path !== "/ws") {
    log("refuse_ws", { uid: caller.uid, path });
    socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    return;
  }
  wss.handleUpgrade(req, socket, head, (client) => bridgeWs(client, caller));
});

function bridgeWs(client, caller) {
  // Upstream: the daemon's /ws on its Unix socket. No credential forwarded from
  // the agent; the socket's file mode is the daemon's admission check.
  const upstream = new WebSocket(`ws+unix://${config.daemon.socket}:/ws`, { headers: { host: "localhost" } });
  const pending = [];
  let open = false;
  upstream.on("open", () => {
    open = true;
    for (const m of pending) upstream.send(m);
    pending.length = 0;
  });
  upstream.on("message", (data, isBinary) => {
    if (client.readyState === WebSocket.OPEN) client.send(data, { binary: isBinary });
  });
  upstream.on("close", () => client.close());
  upstream.on("error", (err) => {
    log("ws_upstream_error", { error: String(err) });
    client.close();
  });
  client.on("close", () => upstream.close());
  // Serialize client frames so a slow policy lookup cannot reorder them.
  let chain = Promise.resolve();
  client.on("message", (data, isBinary) => {
    chain = chain.then(async () => {
      if (isBinary) {
        log("ws_refuse_binary", { caller: caller.agentId });
        return;
      }
      const out = await policy.filterWsFrame(caller.agentId, data.toString("utf8"), (refusal) => {
        if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(refusal));
      });
      if (out === null) return;
      if (open) upstream.send(out);
      else pending.push(out);
    }).catch((err) => log("ws_error", { error: String(err?.stack ?? err) }));
  });
}

const [lhost, lport] = config.listen.split(":");
ingress.listen(Number(lport), lhost, () => log("listening", { listen: config.listen }));


// ---------- connected-host link proxies (daemon OS user only) ----------
// The origin daemon registers the destination host as one of these sockets.
// Agents cannot reach these sockets or the destination daemon; their routed
// requests enter through the ingress above, where host grants apply.
for (const link of config.links ?? []) {
  if (existsSync(link.listen)) unlinkSync(link.listen);
  const srv = createNetServer((inbound) => {
    const out = netConnect(link.target);
    inbound.pipe(out).pipe(inbound);
    const close = () => {
      inbound.destroy();
      out.destroy();
    };
    inbound.on("error", close);
    out.on("error", close);
    log("link_connection", { serverId: link.serverId });
  });
  srv.listen(link.listen, () => chmodSync(link.listen, 0o600));
}

process.on("SIGTERM", () => process.exit(0));
