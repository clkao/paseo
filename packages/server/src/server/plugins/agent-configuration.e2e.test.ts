import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, vi } from "vitest";
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

/** A plugin that requires itself for every agent it creates; `loadDelayMs` slows its load. */
async function writeRequiringPlugin(directory: string, loadDelayMs = 0): Promise<void> {
  await writeFile(
    path.join(directory, "paseo-plugin.json"),
    JSON.stringify({ id: "required-sandbox", requirements: { paseo: ">=0.14.0-beta.1" } }),
  );
  await writeFile(
    path.join(directory, "index.server.ts"),
    `
export default function contribute(server) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ${loadDelayMs});
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
  const { client: codex, launches } = launchCountingCodex({
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
    held.resolve();
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

    // Due while the restarted daemon is still loading the plugin, which now takes 3 s.
    const scheduleFile = path.join(
      options.paseoHomeRoot,
      ".paseo",
      "schedules",
      `${scheduleId}.json`,
    );
    const stored = JSON.parse(await readFile(scheduleFile, "utf8"));
    await writeFile(
      scheduleFile,
      JSON.stringify({ ...stored, nextRunAt: new Date(Date.now() + 1_500).toISOString() }),
    );
    await writeRequiringPlugin(pluginDirectory, 3_000);
    const second = await createTestPaseoDaemon({
      ...options,
      agentClients: { codex: launchCountingCodex().client },
    });
    const secondClient = new DaemonClient({
      url: `ws://127.0.0.1:${second.port}/ws`,
      appVersion: "0.14.0-beta.1",
    });
    try {
      // The scheduler started after the plugin loaded, so the run never failed on its absence.
      const restarted = JSON.parse(await readFile(scheduleFile, "utf8"));
      expect(restarted.runs).toEqual([]);
      await secondClient.connect();
      const ran = await secondClient.scheduleRunOnce({ id: scheduleId });
      expect(ran.schedule?.runs.map((run) => run.status)).toEqual(["succeeded"]);
    } finally {
      await secondClient.close();
      await second.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 60_000);
