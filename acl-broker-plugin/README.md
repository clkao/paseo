# Paseo ACL broker prototype

This Linux directory plugin gives each interactive session a Unix socket and the stdio MCP server `paseo-acl`. A 256-bit bearer travels from the plugin to its sidecar over stdin. The sidecar adds it to each operation on a private pipe. The plugin retains a SHA-256 verifier and uses its own `context.paseo` session to perform authorized operations.

An agent can send a prompt to a local direct child. The broker checks the daemon's parent labels on each send, ignores caller fields, and supplies the verified sender. On create, the broker supplies the parent, inherits the workspace, and removes all `paseo.parent-*` labels from the input. List and status are reads. Every open rotates the listener and bearer. Provider close, plugin reload, and pipe EOF end the old sidecar.

## Run on a dedicated daemon

1. Run `npm ci --omit=dev --ignore-scripts` in this directory for the sidecar's WebSocket dependency.
2. Set `PASEO_ACL_PLUGIN_DIR` in the daemon process environment to the absolute path of this directory. Set `pluginsEnabled: true` and `daemon.mcp.injectIntoAgents: false` in that daemon's config. Use a Unix listener in its private home.
3. Set each provider's `agents.providers.<name>.command` to the provider wrapper and provider name. The broker accepts the configured wrapped provider IDs in `PASEO_ACL_WRAPPED_PROVIDERS` (a comma-separated list defaulting to `codex,claude`).
4. Install this directory on that daemon with `paseo plugin install /absolute/path/to/acl-broker-plugin --home /path/to/private-daemon`.

The supplied `bin/provider` is an exe.dev test stand-in. It expects Linux bubblewrap, socat, Python 3, Codex or Claude under `/usr/local/bin`, and an installed Paseo CLI. Supply the trusted provider settings `ACL_TEST_ROOT` (private directory containing `workspace/` and a gateway-only `codex.toml`), `ACL_CLI` (installed CLI package directory), and `ACL_NODE` (Node binary). Each agent gets a private persistent home and an initially empty writable workspace. The wrapper mounts its listener, bridge, and runtime files. It gives the namespace a loopback HTTPS proxy for `llm.int.exe.xyz:443`. Daemon files, peer homes, host processes, and host network interfaces stay outside. The pathname is a capability inside the sandbox. Host processes with access to those paths are trusted.

## Supported requests

| Surface             | Supported subset                                                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| CLI                 | Local text `paseo send <full-id> <prompt>`, including `--no-wait` and the default wait. The listener also handles the finish RPC. |
| `send_agent_prompt` | `agentId`, `prompt`. Sends with agent provenance and steer behavior.                                                              |
| `create_agent`      | `provider` in provider/model form, `title`, `initialPrompt`, optional string labels. Creates a child in the caller's workspace.   |
| `list_agents`       | A directory page with optional `limit` (1–200, default 50).                                                                       |
| `get_agent_status`  | `agentId`. Returns `status` and `snapshot`.                                                                                       |

The proof covers these fields. Advanced CLI workspace creation, log streaming, completion notifications, and remote hosts are outside this prototype. A lost reply to a mutation can leave its outcome unknown. Check daemon state before retrying.
