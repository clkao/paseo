// Only operations with a known target and attribution contract may cross the broker.
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { UUID } from "./directory.mjs";

const directTools = new Set(["send_agent_prompt", "cancel_agent", "archive_agent", "kill_agent"]);
const snapshots = new Set(["get_agent_status", "get_agent_activity"]);
const publicReads = new Set(["list_hosts", "list_workspaces", "list_agents"]);
const optionalReads = new Set(["list_models", "list_profiles", "list_providers"]);
const permit = (rule) => ({ allow: true, rule });
const deny = (rule, reason) => ({ allow: false, rule, reason });

export function identityConflict(id, claims) {
  return claims.some((value) => value !== id);
}

export class Policy {
  constructor({ directory, localServerId, grantsPath, log }) {
    Object.assign(this, { directory, localServerId, grantsPath, log });
  }

  async decideMcp(caller, tool, args) {
    const { serverId = this.localServerId, agentId } = args;
    const rules = JSON.parse(readFileSync(this.grantsPath, "utf8"));
    // Only the operator writes the membership table. Runtime labels are mutable.
    const membership = rules.subjects?.[caller] ?? {};
    function granted(act, matches) {
      return rules.grants.some(({ subject, resource, acts }) =>
        (subject.agent === caller ||
         (subject.label && membership.labels?.includes(subject.label)) ||
         (subject.project && subject.project === membership.project)) &&
        acts.includes(act) && matches(resource));
    }
    const direct = directTools.has(tool);
    const act = direct ? "direct" : tool === "create_agent" ? "create" : "read";
    if (serverId !== this.localServerId && !granted(act, r => r.host === serverId)) {
      return deny("host", "no grant for the destination host");
    }
    if (tool === "create_agent") {
      const keys = ["serverId", "title", "provider", "initialPrompt", "notifyOnFinish", "settings"];
      if (!Object.keys(args).every(k => keys.includes(k)) ||
          !/^codex(?:\/[a-zA-Z0-9.-]+)?$/.test(args.provider ?? "") ||
          !Object.keys(args.settings ?? {}).every(k => k === "modeId")) {
        return deny("create", "creation requires the wrapped Codex provider in the inherited workspace");
      }
      return permit("create");
    }
    if (publicReads.has(tool)) return permit("read");
    if (optionalReads.has(tool) && granted(act, r => r.tool === tool)) return permit("tool");
    if (!direct && !snapshots.has(tool)) return deny("tool", "tool is unavailable");
    if (typeof agentId !== "string" || !UUID.test(agentId)) return deny("rule1", "full target ID required");
    if (!direct && caller === agentId && serverId === this.localServerId) return permit("self");
    const target = await this.directory.getAgent(agentId, serverId);
    if (target?.parentAgentId === caller && target.parentServerId === this.localServerId) return permit("rule1");
    if (!direct && target && granted("read", r => r.agent === agentId ||
        (target.workspaceId && r.workspace === target.workspaceId))) return permit("grant");
    return deny("rule1", "caller did not start the target agent");
  }

  async filterWsFrame(caller, text, reply) {
    const msg = JSON.parse(text);
    if (msg?.type === "hello") {
      // Isolate the upstream session from every other CLI session.
      return JSON.stringify({ type: "hello", clientId: randomUUID(), clientType: "cli",
        protocolVersion: msg.protocolVersion, capabilities: { explicitEventSubscriptions: true } });
    }
    if (msg?.type === "ping") return JSON.stringify({ type: "ping" });
    const inner = msg?.type === "session" && msg.message;
    const type = inner?.type;
    const claims = ["sourceAgentId", "callerAgentId"].filter(k => Object.hasOwn(inner ?? {}, k)).map(k => inner[k]);
    let decision;
    if (identityConflict(caller, claims) || inner?.sourceAgentServerId !== undefined) {
      decision = deny("identity", "caller identity does not match the connection");
    } else if (type === "send_agent_message_request") {
      decision = await this.decideMcp(caller, "send_agent_prompt", { agentId: inner.agentId });
    } else if (type === "wait_for_finish_request") {
      decision = await this.decideMcp(caller, "get_agent_status", { agentId: inner.agentId });
    } else {
      decision = deny("tool", "RPC is unavailable");
    }
    this.log("ws", { caller, type, target: inner?.agentId, ...decision });
    if (!decision.allow) {
      reply({ type: "session", message: { type: "rpc_error", payload: {
        requestId: inner?.requestId ?? "unknown", requestType: type, code: "forbidden",
        error: "acl-broker refused: " + decision.reason } } });
      return null;
    }
    const { requestId, agentId, text: prompt, activeTurnBehavior, timeoutMs } = inner;
    const message = type === "send_agent_message_request"
      ? { type, requestId, agentId, text: prompt, activeTurnBehavior, sourceAgentId: caller }
      : { type, requestId, agentId, timeoutMs };
    return JSON.stringify({ type: "session", message });
  }
}
