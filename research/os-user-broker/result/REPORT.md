# Paseo agent broker on paseo-acl-prototype

On 2026-11-19 UTC, AC-2, AC-3 and AC-4 passed against two private Paseo 0.16.2 daemons. AC-1 is partial. The enabled broker refused all three requests, including the one naming the online destination. The live identity-disabled success control was not run. Testing stopped before AC-5.

## Code and fixture

Branch `acl/broker` on `clkao/paseo`. First pushed checkpoint `96a12148413c7ee11da6db14acb2933341482972`. Final head `eeb18af3bd217a5c1a731cad6f99ee64620ed2a3`. The checkout's `upstream/main` and the branch base were `d8c98400fbc55aa7d17b1862a093d8b17019d985`. All branch changes are under `acl-broker/`. The tests used the installed Paseo 0.16.2 CLI and server on the VM. No files in `packages/` changed.

I kept the previous agent's dedicated Linux accounts, CLI installation, private directory layout, UID lookup, launcher registration, daemon directory lookup and connected-host Unix relay. I inspected both inherited Claude test homes and stopped their verified supervisors (21304 and 21361) before creating the Codex fixture. The new work includes the Codex wrapper, gateway configuration, rejection of conflicting identity fields, default-deny RPC handling, atomic registry writes, trusted grant membership, reply filtering, destination UID separation, loopback filtering and live acceptance scripts.

The origin, destination and broker ran as `exedev`. The two fixture slots were 7901 and 7902 under `/tmp/paseo-broker-4rpazfuf`. Those numbers identify directories. The Paseo control listeners were Unix sockets. The external broker ingress was `127.0.0.1:7900`. The origin registered the destination through the broker's private `host.sock` and reported it online. The live service on 6767 received no test commands or configuration changes. [Fixture observations](tests/observations.log) · [Link registration](tests/link.log)

| Role | Daemon | Account | UID | Agent |
|---|---|---|---:|---|
| P | origin | acl-ag1 | 1002 | 053698ba-3c85-4ab0-ba77-030494c4b5f0 |
| A | origin | acl-ag2 | 1003 | f0968f54-ff18-4385-9208-428e095bfcf7 |
| B, started by P through MCP | origin | acl-ag3 | 1004 | ff98ea98-7018-482c-b3e8-321237c82051 |
| R, operator-started destination target | destination | acl-ag4 | 1005 | 4ea203f3-df54-4f57-953d-171346df2475 |

## Identity, confinement and grants

The trusted provider wrapper registers the daemon-assigned agent ID over a private admin socket before starting Codex. It changes to the assigned Linux UID using sudo and supplies a fresh environment. Provider probes run as the unregistered `acl-probe` user. Registry entries persist across broker restarts. The fixture allocates each UID once. On ingress the broker matches the reverse TCP address/port pair to an established socket with a live inode in Linux procfs. The kernel supplies that socket's UID. An ordinary A process cannot select P's UID. Different UIDs and private home directories isolate their environment and files. The broker refuses unsupported peers, including destination-only UIDs on the origin ingress.

The broker compares supplied identity fields against that mapping before a forwarding decision. It constructs the upstream MCP URL with the verified caller and constructs CLI message RPCs with the verified sender. The upstream CLI session also gets a fresh broker-generated client ID. The origin daemon's stored parent ID and parent server ID determine ownership. An agent can create wrapped Codex children in its inherited workspace. Arbitrary RPCs, provider choices and caller-selected launch environments are unavailable.

The operator-owned grants file supports agent, label and project subjects. Label and project membership come from the operator's membership table. Grants can authorize reads of a named agent or workspace, selected tools, or an act on a particular host. A host decision precedes a routed target lookup, and direct operations still require parentage. The live stop-line run used an empty grant list. Positive label, project and remote-grant behavior remains unverified.

The test root was mode 0700, both local credentials were mode 0600, and the admin and host-link sockets sat inside the private root. The shared test workspace was operator-owned and read-only to the agent accounts. Listener inspection found that each stock daemon also opened an auxiliary loopback OpenCode bridge. I added a fixture-specific nftables output rule covering only the nine test UIDs. It rejected loopback TCP to ports other than 7900. Both observed worker-owned TCP ports refused A after installation. The final AC run used this rule. [UID filter and counters](tests/firewall.log) · [Socket and credential checks](tests/AC-3.log)

Paseo's 6767 config specified the Codex provider label. Its native Codex config supplied model `gpt-6.2-sol` and the exe.dev Responses gateway `https://llm.int.exe.xyz/openai/v1`. The wrapper used those settings and set the agent's MCP URL to the broker. Initially, `injectIntoAgents=false` emptied the scoped tool catalog and child creation returned JSON-RPC `-32601 Method not found`. The final fixture uses `injectIntoAgents=true` on strictly Unix-only control listeners. Paseo's `createAgentMcpBaseUrl` returns null for Unix listeners, and the Codex provider has no native Paseo tool bridge. After the fixture worker reload I resumed P so the daemon could resolve its live parent context. P's actual Codex session completed `paseo.list_hosts` after its ordinary tool approval, and the broker logged P's UID for that call. [Codex tool and stored records](tests/observations.log) · [Broker audit](tests/audit.jsonl)

## Acceptance commands and output

Run from `~/paseo` with `root=/tmp/paseo-broker-4rpazfuf`. The linked transcripts include the expanded commands, identities and outputs. The CLI and HTTP acceptance clients were deterministic processes under the launcher-assigned UIDs. The separate Codex tool observation above checked normal provider wiring.

| Test | Command | Observed output |
|---|---|---|
| AC-1, three enforced denials | `python3 acl-broker/test/acceptance.py "$root" AC-1` | CLI exited 1 with code `forbidden`. Both MCP calls returned `isError: true`. Each said `caller identity does not match the connection`. The local target was B and the host-scoped target was R on `srv_mTjNE67fc8ql`. Recipient timelines contained zero rejected markers. [Commands and results](tests/AC-1.log) |
| AC-2 | `python3 acl-broker/test/acceptance.py "$root" AC-2` | A supplied no caller ID. The MCP result was `acl-broker refused: caller did not start the target agent`. [Transcript](tests/AC-2.log) |
| AC-3 | `python3 acl-broker/test/acceptance.py "$root" AC-3` | Both Unix connects and both credential reads returned errno 13, `Permission denied`. A's connects to worker ports 44175 and 37461 returned errno 111, `Connection refused`. [Transcript](tests/AC-3.log) |
| AC-4 | `python3 acl-broker/test/acceptance.py "$root" AC-4` | CLI and MCP both returned `queued`. B's timeline recorded both unique messages ending in `1795047646742065111`, each with sender `053698ba-3c85-4ab0-ba77-030494c4b5f0` (P). B's persisted labels also named P and origin `srv_xd5vw6qNzf2l`. [Receipts and child timeline](tests/AC-4.log) · [P creating B](tests/child.log) |
| AC-5 | Deferred at the requested stop line | No host grant was issued. The pending test is P directing its child RC on the granted destination, followed by A being denied that destination. |

**Outstanding AC-1 control.** The requested comparison would remove verified attribution and deliver A's CLI, local MCP and routed messages as P on live daemons. I did not enable live impersonation or ship the inherited bypass switch. Removing just the mismatch rejection from this implementation would still leave A's verified identity on the upstream request. The routed denial used a real operator-started destination agent. It did not establish a remote parent-child relationship for P. The earlier mandate's unbrokered results are separate evidence.

## Reproducing the fixture

Use the repository copies of the scripts so the wrapper path resolves into the checkout. The dedicated accounts and `/opt/acl-broker/bin/paseo` already exist on this VM. These commands require the VM network/process namespace and sudo for the fixture accounts and nftables. Use a fresh, exclusive UID pool or reset old account state and terminate all previous processes before assigning those UIDs to new identities. The prototype does not implement UID retirement or multi-operator allocation.

```bash
cd ~/paseo
unset PASEO_HOST PASEO_AGENT_ID PASEO_AGENT_CWD PASEO_WORKSPACE_ID
root=$(python3 acl-broker/test/setup.py)
python3 acl-broker/test/isolation.py "$root" install
for slot in 7901 7902; do
  /opt/acl-broker/bin/paseo daemon start --home "$root/$slot" --timeout 60
done
python3 acl-broker/test/configure.py "$root"
node acl-broker/src/broker.mjs --config "$root/broker/config.json" &
broker_pid=$!
for step in roots child link destination AC-1 AC-2 AC-3 AC-4; do
  python3 acl-broker/test/acceptance.py "$root" "$step" || break
done
for slot in 7901 7902; do
  /opt/acl-broker/bin/paseo daemon stop --home "$root/$slot"
done
kill "$broker_pid"
wait "$broker_pid"
python3 acl-broker/test/isolation.py "$root" remove
```

The test archive contains the acceptance runner, fixture configuration scripts, read-only evidence collector, full transcripts and broker decision log. [Acceptance runner](tests/acceptance.py) · [Fixture setup](tests/setup.py) · [Broker configuration](tests/configure.py) · [Network isolation](tests/isolation.py)

## Shutdown and publication

Both final test homes reported `localDaemon: stopped`. The broker exited, no listeners remained on port 7900 or under either the old or new test root, and the fixture's nftables table was removed. A final process check found no surviving processes under UIDs 1001–1009. `git ls-remote origin refs/heads/acl/broker` returned `eeb18af3bd217a5c1a731cad6f99ee64620ed2a3`. The checkout matched the remote branch. [Shutdown output](tests/shutdown.log)
