import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, vi } from "vitest";
import { BuiltinPluginLoader } from "./builtin/index.js";
import { ScheduleService } from "../schedule/service.js";
import { DaemonClient } from "../test-utils/daemon-client.js";
import type { AgentClient, AgentSessionConfig } from "../agent/agent-sdk-types.js";
import { createTestAgentClient } from "../test-utils/fake-agent-client.js";
import { createTestPaseoDaemon } from "../test-utils/paseo-daemon.js";

test("the configuration example saves Codex options and injects launch-only MCP servers while preserving other configuration", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "paseo-config-example-"));
  const launches: AgentSessionConfig[] = [];
  const daemon = await createTestPaseoDaemon({
    daemonVersion: "0.14.0-beta.1",
    agentClients: {
      codex: createTestAgentClient("codex", {
        supportsMcpServers: true,
        beforeCreateSession: async (config) => {
          launches.push(config);
        },
      }),
    },
    mcpEnabled: false,
  });
  const client = new DaemonClient({
    url: `ws://127.0.0.1:${daemon.port}/ws`,
    appVersion: "0.14.0-beta.1",
  });
  try {
    await client.connect();
    await client.fetchAgents({ subscribe: {} });
    await client.patchDaemonConfig({ pluginsEnabled: true });
    await client.installDirectoryPlugin(
      fileURLToPath(new URL("../../../../../plugin-examples/agent-configuration", import.meta.url)),
    );
    const agent = await client.createAgent({
      provider: "codex",
      cwd: directory,
      systemPrompt: "Keep the user's instructions.",
      providerOptions: {
        sandbox_mode: "read-only",
        approval_policy: "never",
        web_search: "disabled",
      },
      mcpServers: { existing: { type: "http", url: "https://existing.example.com/mcp" } },
    });
    expect(daemon.daemon.agentManager.getAgent(agent.id)?.config).toMatchObject({
      provider: "codex",
      cwd: directory,
      systemPrompt: "Keep the user's instructions.",
      providerOptions: {
        sandbox_mode: "workspace-write",
        approval_policy: "on-request",
        web_search: "disabled",
      },
      mcpServers: {
        existing: { type: "http", url: "https://existing.example.com/mcp" },
      },
    });
    expect(daemon.daemon.agentManager.getAgent(agent.id)!.config.mcpServers).toEqual({
      existing: { type: "http", url: "https://existing.example.com/mcp" },
    });
    expect(launches[0].mcpServers).toEqual({
      existing: { type: "http", url: "https://existing.example.com/mcp" },
      company: { type: "http", url: "https://tools.example.com/mcp" },
    });
    await client.archiveAgent(agent.id);
  } finally {
    await client.close();
    await daemon.close();
    await rm(directory, { recursive: true, force: true });
  }
}, 60_000);

test("session-open entrypoint contributions are optional and rederived for existing agents", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "paseo-entrypoint-hook-"));
  const launches: { provider: string; env?: Record<string, string> }[] = [];
  function recordingProvider(provider: "claude" | "codex"): AgentClient {
    const inner = createTestAgentClient(provider);
    return {
      provider: inner.provider,
      capabilities: inner.capabilities,
      isAvailable: () => inner.isAvailable(),
      fetchCatalog: (options) => inner.fetchCatalog(options),
      createSession: async (...args: Parameters<typeof inner.createSession>) => {
        launches.push({ provider, env: args[1]?.env });
        return inner.createSession(...args);
      },
      resumeSession: async (...args: Parameters<typeof inner.resumeSession>) => {
        launches.push({ provider, env: args[2]?.env });
        return inner.resumeSession(...args);
      },
    };
  }
  const daemon = await createTestPaseoDaemon({
    daemonVersion: "0.14.0-beta.2",
    agentClients: { claude: recordingProvider("claude"), codex: recordingProvider("codex") },
    mcpEnabled: false,
  });
  const client = new DaemonClient({
    url: `ws://127.0.0.1:${daemon.port}/ws`,
    appVersion: "0.14.0-beta.2",
  });
  try {
    await writeFile(
      path.join(directory, "paseo-plugin.json"),
      JSON.stringify({ id: "entrypoint-test", requirements: { paseo: ">=0.14.0-beta.2" } }),
    );
    await writeFile(
      path.join(directory, "index.server.ts"),
      `
export default function contribute(server) {
  return server.before("agent.session_open", ({ request }) => {
    if (request.provider !== "claude") return;
    return { ...request, env: { ...request.env, CLAUDE_CODE_ENTRYPOINT: "custom-client" } };
  });
}
`,
    );
    await client.connect();
    await client.fetchAgents({ subscribe: {} });
    const existing = await client.createAgent({ provider: "claude", cwd: directory });
    expect(launches.at(-1)?.env?.CLAUDE_CODE_ENTRYPOINT).toBeUndefined();
    await client.patchDaemonConfig({ pluginsEnabled: true });
    await client.installDirectoryPlugin(directory);
    await daemon.daemon.agentManager.reloadAgentSession(existing.id);
    expect(launches.at(-1)?.env?.CLAUDE_CODE_ENTRYPOINT).toBe("custom-client");
    await client.createAgent({ provider: "claude", cwd: directory });
    expect(launches.at(-1)?.env?.CLAUDE_CODE_ENTRYPOINT).toBe("custom-client");
    await client.createAgent({ provider: "codex", cwd: directory });
    expect(launches.at(-1)).toMatchObject({ provider: "codex" });
    expect(launches.at(-1)?.env?.CLAUDE_CODE_ENTRYPOINT).toBeUndefined();
    await client.disablePlugin("entrypoint-test");
    await daemon.daemon.agentManager.reloadAgentSession(existing.id);
    expect(launches.at(-1)?.env?.CLAUDE_CODE_ENTRYPOINT).toBeUndefined();
  } finally {
    await client.close();
    await daemon.close();
    await rm(directory, { recursive: true, force: true });
  }
}, 60_000);

async function writeRequiringPlugin(directory: string): Promise<void> {
  await writeFile(
    path.join(directory, "paseo-plugin.json"),
    JSON.stringify({ id: "required-sandbox", requirements: { paseo: ">=0.14.0-beta.1" } }),
  );
  await writeFile(
    path.join(directory, "index.server.ts"),
    `
export default function contribute(server) {
  server.addHook("agent.create.before", async ({ request }) =>
    request.requirePlugin === undefined ? request : { ...request, requirePlugin: true },
  );
  server.addHook("agent.open.before", async ({ request }) => request);
  return () => {};
}
`,
  );
}

function launchCountingCodex(options: Parameters<typeof createTestAgentClient>[1] = {}): {
  client: AgentClient;
  launches: () => number;
} {
  let launches = 0;
  const client = createTestAgentClient("codex", {
    ...options,
    beforeCreateSession: async () => {
      launches += 1;
    },
    beforeResumeSession: async () => {
      launches += 1;
    },
  });
  return { client, launches: () => launches };
}

test("an agent that requires its plugin opens only while the plugin is enabled", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "paseo-required-plugin-"));
  const held = Promise.withResolvers<void>();
  const interrupt = vi.fn(() => held.resolve());
  const steer = vi.fn(async () => ({ status: "accepted" as const }));
  const start = vi.fn();
  const { client: codex, launches } = launchCountingCodex({
    steerActiveTurn: steer,
    onStartTurn: start,
    beforeTurnComplete: () => held.promise,
    onInterrupt: interrupt,
  });
  const daemon = await createTestPaseoDaemon({
    daemonVersion: "0.14.0-beta.1",
    agentClients: { codex },
    mcpEnabled: false,
  });
  const client = new DaemonClient({
    url: `ws://127.0.0.1:${daemon.port}/ws`,
    appVersion: "0.14.0-beta.1",
  });
  const manager = daemon.daemon.agentManager;
  try {
    await writeRequiringPlugin(directory);
    await client.connect();
    await client.fetchAgents({ subscribe: {} });
    await client.patchDaemonConfig({ pluginsEnabled: true });
    // Installed under its own ID: the requirement names the runtime ID, not the manifest's.
    await client.installDirectoryPlugin(directory, "sandbox-runtime");
    const agent = await client.createAgent({ provider: "codex", cwd: directory });
    await manager.flush();
    expect((await daemon.daemon.agentStorage.get(agent.id))?.requiresPlugins).toEqual([
      "sandbox-runtime",
    ]);
    const handle = manager.getAgent(agent.id)!.persistence!;

    await client.sendMessage(agent.id, "hold the turn");
    await vi.waitFor(() => expect(manager.getAgent(agent.id)?.lifecycle).toBe("running"));
    await client.disablePlugin("sandbox-runtime");
    const before = launches();
    const refused = {
      code: "agent_refresh_failed",
      message: expect.stringContaining("sandbox-runtime"),
    };
    await expect(client.refreshAgent(agent.id)).rejects.toMatchObject(refused);
    expect.soft(interrupt).not.toHaveBeenCalled();
    expect.soft(manager.getAgent(agent.id)?.lifecycle).toBe("running");
    for (const behavior of ["steer", "interrupt"] as const) {
      await expect(
        client.sendMessage(agent.id, "new input", { activeTurnBehavior: behavior }),
      ).rejects.toThrow("sandbox-runtime");
    }
    expect(steer).not.toHaveBeenCalled();
    expect(interrupt).not.toHaveBeenCalled();
    expect(start).toHaveBeenCalledTimes(1);
    await client.cancelAgent(agent.id);
    expect(interrupt).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(manager.hasInFlightRun(agent.id)).toBe(false));
    const archived = await client.archiveAgent(agent.id);
    await expect(client.refreshAgent(agent.id)).rejects.toMatchObject(refused);
    expect
      .soft((await daemon.daemon.agentStorage.get(agent.id))?.archivedAt)
      .toBe(archived.archivedAt);
    await expect(client.resumeAgent(handle, { cwd: directory })).rejects.toMatchObject({
      code: "agent_resume_failed",
      message: expect.stringContaining("sandbox-runtime"),
    });
    expect((await daemon.daemon.agentStorage.get(agent.id))?.archivedAt).toBe(archived.archivedAt);
    expect(launches()).toBe(before);

    await client.enablePlugin("sandbox-runtime");
    const resumed = await client.resumeAgent(handle, { cwd: directory });
    expect(resumed.id).not.toBe(agent.id);
    expect(launches()).toBe(before + 1);
    await manager.flush();
    expect((await daemon.daemon.agentStorage.get(resumed.id))?.requiresPlugins).toEqual([
      "sandbox-runtime",
    ]);
  } finally {
    held.resolve();
    await client.close();
    await daemon.close();
    await rm(directory, { recursive: true, force: true });
  }
}, 60_000);

test("scheduled runs wait for plugins to load at daemon start", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "paseo-required-plugin-schedule-"));
  const pluginDirectory = path.join(root, "plugin");
  const workspace = path.join(root, "workspace");
  await mkdir(pluginDirectory, { recursive: true });
  await mkdir(workspace, { recursive: true });
  await writeRequiringPlugin(pluginDirectory);
  const options = {
    daemonVersion: "0.14.0-beta.1",
    paseoHomeRoot: path.join(root, "daemon"),
    staticDir: path.join(root, "static"),
    cleanup: false,
    mcpEnabled: false,
    pluginsEnabled: true,
    plugins: {
      "required-sandbox": { source: "directory" as const, path: pluginDirectory, enabled: true },
    },
  };
  try {
    const first = await createTestPaseoDaemon({
      ...options,
      agentClients: { codex: launchCountingCodex().client },
    });
    const firstClient = new DaemonClient({
      url: `ws://127.0.0.1:${first.port}/ws`,
      appVersion: "0.14.0-beta.1",
    });
    let scheduleId: string;
    try {
      await firstClient.connect();
      await firstClient.fetchAgents({ subscribe: {} });
      const agent = await firstClient.createAgent({ provider: "codex", cwd: workspace });
      const created = await firstClient.scheduleCreate({
        prompt: "check in",
        cadence: { type: "cron", expression: "0 0 1 1 *" },
        target: { type: "agent", agentId: agent.id },
      });
      scheduleId = created.schedule!.id;
    } finally {
      await firstClient.close();
      await first.close();
    }

    const scheduleFile = path.join(
      options.paseoHomeRoot,
      ".paseo",
      "schedules",
      `${scheduleId}.json`,
    );
    const readSchedule = async () => JSON.parse(await readFile(scheduleFile, "utf8"));
    const due = "2030-01-02T00:00:02.000Z";
    await writeFile(scheduleFile, JSON.stringify({ ...(await readSchedule()), nextRunAt: due }));

    const loading = Promise.withResolvers<void>();
    const ready = Promise.withResolvers<void>();
    const loader = new BuiltinPluginLoader(undefined, []);
    vi.spyOn(loader, "load").mockImplementation(async () => {
      loading.resolve();
      await ready.promise;
    });
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(new Date("2030-01-02T00:00:00.000Z"));
    const ticks = vi.spyOn(ScheduleService.prototype, "tick");
    const restarting = createTestPaseoDaemon({
      ...options,
      builtinPlugins: loader,
      agentClients: { codex: launchCountingCodex().client },
    });
    try {
      await Promise.race([
        loading.promise,
        restarting.then(() => {
          throw new Error("Plugin loader did not run");
        }),
      ]);
      await vi.advanceTimersByTimeAsync(2_000);
      expect(ticks).not.toHaveBeenCalled();
      expect(await readSchedule()).toMatchObject({ nextRunAt: due, runs: [] });
      ready.resolve();
      await restarting;
      await vi.advanceTimersByTimeAsync(1_000);
      expect(ticks).toHaveBeenCalledTimes(1);
      await ticks.mock.results[0]!.value;
      expect((await readSchedule()).runs).toEqual([
        expect.objectContaining({ scheduledFor: due, status: "succeeded" }),
      ]);
    } finally {
      ready.resolve();
      try {
        await (await restarting).close();
      } finally {
        ticks.mockRestore();
        vi.useRealTimers();
      }
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 60_000);
