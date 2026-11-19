"""Minimal stdio MCP server. On start it probes fd 3 and the named socket (label from argv[1]),
logging only to stderr and PROBE_CLIENT_LOG; stdout carries JSON-RPC only."""
import json, os, sys, contextlib, io
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import client

def run_probe(label):
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        client.probe(label)
    sys.stderr.write(buf.getvalue()); return buf.getvalue().strip()

# Codex starts MCP servers with a filtered env, so also log to a fixed file.
os.environ.setdefault('PROBE_CLIENT_LOG2', '/tmp/agent-channel-probe/mcp-probe.log')
label = sys.argv[1] if len(sys.argv) > 1 else 'mcp'
startup = run_probe(f'{label}-startup')

def reply(i, result):
    sys.stdout.write(json.dumps({'jsonrpc': '2.0', 'id': i, 'result': result}) + '\n'); sys.stdout.flush()

for line in sys.stdin:
    try: m = json.loads(line)
    except ValueError: continue
    meth, i = m.get('method'), m.get('id')
    if i is None: continue
    if meth == 'initialize':
        reply(i, {'protocolVersion': m['params'].get('protocolVersion', '2025-06-18'),
                  'capabilities': {'tools': {}}, 'serverInfo': {'name': 'channel-probe', 'version': '0'}})
    elif meth == 'tools/list':
        reply(i, {'tools': [{'name': 'channel_probe', 'description': 'Probe the agent channel',
                             'inputSchema': {'type': 'object', 'properties': {}}}]})
    elif meth == 'tools/call':
        reply(i, {'content': [{'type': 'text', 'text': run_probe(f'{label}-toolcall')}]})
    else:
        reply(i, {})
