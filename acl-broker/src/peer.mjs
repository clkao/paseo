// Peer uid of a loopback TCP connection, from /proc/net/tcp{,6}.
//
// The kernel records the uid of the process that created each socket. For a
// connection accepted by the broker, the client's own socket appears with
// local = client address and remote = broker address. Its uid is the client's
// OS user. A process cannot create a socket under another uid without root.
import { readFileSync } from "node:fs";

function hexIpv4(addr) {
  // /proc/net/tcp prints the address as a little-endian 32-bit hex word.
  const parts = addr.split(".").map(Number);
  return parts
    .reverse()
    .map((p) => p.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function hexPort(port) {
  return port.toString(16).padStart(4, "0").toUpperCase();
}

function hexIpv6Mapped(addr) {
  // ::ffff:a.b.c.d as four little-endian 32-bit words.
  return "0000000000000000FFFF0000" + hexIpv4(addr);
}

export function peerUid(socket) {
  const ra = socket.remoteAddress?.replace(/^::ffff:/, "");
  const rp = socket.remotePort;
  const la = socket.localAddress?.replace(/^::ffff:/, "");
  const lp = socket.localPort;
  if (!ra || !rp || !la || !lp) return null;
  const want4 = { local: `${hexIpv4(ra)}:${hexPort(rp)}`, remote: `${hexIpv4(la)}:${hexPort(lp)}` };
  const want6 = { local: `${hexIpv6Mapped(ra)}:${hexPort(rp)}`, remote: `${hexIpv6Mapped(la)}:${hexPort(lp)}` };
  for (const [file, want] of [["/proc/net/tcp", want4], ["/proc/net/tcp6", want6]]) {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const line of text.split("\n").slice(1)) {
      const f = line.trim().split(/\s+/);
      if (f.length < 8) continue;
      if (f[3] === "01" && Number(f[9]) > 0 && f[1] === want.local && f[2] === want.remote) return Number(f[7]);
    }
  }
  return null;
}
