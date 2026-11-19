import type { PluginHookContext } from "@getpaseo/plugin/server";
import { z } from "zod";
import { Denied } from "./credentials";

interface Session {
  id: string;
  providers: ReadonlySet<string>;
  cwd: string;
  paseo: PluginHookContext["paseo"];
}

const text = z.string().min(1).max(65536);
const id = z.string().min(1).max(256);
const send = z.object({ agentId: id, prompt: text });
const create = z.object({
  provider: text,
  title: z.string().trim().min(1).max(60),
  initialPrompt: text,
  labels: z.record(z.string().max(128), z.string().max(1024)).optional(),
});
const listing = z.object({ limit: z.number().int().min(1).max(200).default(50) });

async function createChild(session: Session, args: unknown) {
  const input = create.parse(args);
  // Keep children within the administrator's wrapped providers and the caller's placement.
  const parts = input.provider.split("/");
  if (parts.length !== 2 || !session.providers.has(parts[0]) || !parts[1]) {
    throw new Denied("PROVIDER_DENIED");
  }
  const labels = Object.fromEntries(
    Object.entries(input.labels ?? {}).filter(([key]) => !key.startsWith("paseo.parent-")),
  );
  const child = await session.paseo.agents.create({
    config: { provider: input.provider },
    cwd: session.cwd,
    parent: session.paseo.agents.ref(session.id),
    title: input.title,
    prompt: input.initialPrompt,
    labels,
  });
  const snapshot = child.current();
  return {
    agentId: child.id,
    type: parts[0],
    status: snapshot?.status,
    cwd: session.cwd,
    workspaceId: child.workspaceId,
    currentModeId: snapshot?.currentModeId ?? null,
    availableModes: child.availableModes ?? [],
  };
}

export async function dispatch(
  session: Session,
  operation: string,
  args: unknown,
  active: () => boolean,
) {
  const { paseo, id: caller } = session;
  if (args && typeof args === "object" && "serverId" in args) {
    throw new Denied("REMOTE_DENIED");
  }
  const agents = paseo.agents;
  const parent = agents.ref(caller);
  function checkActive() {
    if (!active()) throw new Denied("TOKEN_REVOKED");
  }
  async function lookup(agentId: string) {
    const handle = agents.ref(agentId);
    const record = await handle.refresh();
    const labels = record?.agent.labels;
    const localChild =
      labels?.["paseo.parent-agent-id"] === caller &&
      (!labels["paseo.parent-server-id"] ||
        labels["paseo.parent-server-id"] === parent.address.serverId);
    checkActive();
    return { record, localChild };
  }

  checkActive();
  switch (operation) {
    case "send_agent_prompt": {
      const input = send.parse(args);
      const target = await lookup(input.agentId);
      if (!target.localChild || !target.record) throw new Denied("NOT_DIRECT_CHILD");
      await agents
        .ref(target.record.agent.id)
        .send(input.prompt, { sourceAgentId: caller, activeTurnBehavior: "steer" });
      return { success: true, status: target.record.agent.status };
    }
    case "create_agent":
      return createChild(session, args);
    case "wait_for_finish": {
      const input = z
        .object({
          agentId: id,
          timeoutMs: z.number().int().min(1).max(600000).optional(),
        })
        .parse(args);
      return agents.ref(input.agentId).waitForFinish(input.timeoutMs ?? 600000);
    }
    case "list_agents": {
      const { limit } = listing.parse(args);
      const page = await agents.list({ page: { limit } });
      return {
        agents: page.entries.map(({ agent }) => ({
          id: agent.id,
          shortId: agent.id.slice(0, 7),
          title: agent.title,
          cwd: agent.cwd,
          status: agent.status,
          provider: agent.provider,
          model: agent.runtimeInfo?.model ?? agent.model,
          createdAt: agent.createdAt,
          updatedAt: agent.updatedAt,
          lastUserMessageAt: agent.lastUserMessageAt,
          labels: agent.labels,
        })),
      };
    }
    case "get_agent_status": {
      const { agentId } = z.object({ agentId: id }).parse(args);
      const { record } = await lookup(agentId);
      if (!record) throw new Denied("UNKNOWN_AGENT");
      return { status: record.agent.status, snapshot: record.agent };
    }
    default:
      throw new Denied("UNSUPPORTED_OPERATION");
  }
}
