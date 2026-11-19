import assert from "node:assert/strict";
import test from "node:test";
import { Credentials } from "../server/credentials";
import { dispatch } from "../server/policy";
import type { PluginHookContext } from "@getpaseo/plugin/server";

function directory() {
  const sends: unknown[] = [];
  const paseo = {
    agents: {
      ref: (agentId: string) => ({
        address: { serverId: "local", agentId },
        refresh: async () => ({
          agent: { id: agentId, labels: { "paseo.parent-agent-id": "parent" } },
        }),
        send: async (...args: unknown[]) => sends.push(args),
      }),
    },
  } as unknown as PluginHookContext["paseo"];
  return { sends, paseo };
}

test("a verified sibling cannot direct the child, regardless of caller fields", async () => {
  const { sends, paseo } = directory();
  const session = { id: "sibling", paseo, providers: new Set(["codex"]), cwd: "/work" };
  for (const fields of [{ sourceAgentId: "parent" }, { callerAgentId: "parent" }, {}]) {
    await assert.rejects(
      dispatch(
        session,
        "send_agent_prompt",
        { ...fields, agentId: "child", prompt: "fixture" },
        () => true,
      ),
      /NOT_DIRECT_CHILD/,
    );
  }
  assert.equal(sends.length, 0);
});

test("revocation while the parent lookup is pending prevents dispatch", async () => {
  const { sends, paseo } = directory();
  const active = new Credentials().issue("parent");
  const sending = dispatch(
    { id: "parent", paseo, providers: new Set(["codex"]), cwd: "/work" },
    "send_agent_prompt",
    { agentId: "child", prompt: "fixture" },
    active.active,
  );
  active.revoke();
  await assert.rejects(sending, /TOKEN_REVOKED/);
  assert.equal(sends.length, 0);
});

test("retired bearer fails verification after opening a new session for the same agent", () => {
  const credentials = new Credentials();
  const previous = credentials.issue("parent");
  assert.equal(credentials.verify(previous.token), "parent");
  previous.revoke();
  const current = credentials.issue("parent");
  assert.notEqual(previous.token, current.token);
  assert.throws(() => credentials.verify(previous.token), /INVALID_TOKEN/);
  assert.throws(() => credentials.verify(undefined), /INVALID_TOKEN/);
  assert.equal(credentials.verify(current.token), "parent");
});
