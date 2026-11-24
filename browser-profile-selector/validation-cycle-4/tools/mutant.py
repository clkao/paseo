from pathlib import Path
import re, subprocess, sys
tools = Path(__file__).resolve().parent
e = tools.parent
target = Path("packages/desktop/e2e/browser-tabs.e2e.mjs")
name = sys.argv[1]
before = subprocess.check_output(["git", "show", f"HEAD:{target}"])
assert target.read_bytes() == before
source = before.decode()
def section(start, end, replacement):
    i = source.index(start)
    j = source.index(end, i)
    return source[:i] + replacement + source[j:]
if name == "mutant-split":
    broken = section("  // Close the launcher's only tab", "  if (failures.length", "")
elif name == "mutant-chooser":
    broken = section("            const { page: reopened } = await launchDesktop();", "            return reopened;", "")
    broken = broken.replace("            return reopened;", "            return (await launchDesktop()).page;")
elif name == "mutant-timeout":
    assert source.count("const desktopStartupTimeoutMs = 240_000;") == 1
    broken = source.replace("const desktopStartupTimeoutMs = 240_000;", "const desktopStartupTimeoutMs = 90_000;")
else:
    raise ValueError(name)
out = e / name
out.mkdir()
try:
    target.write_text(broken)
    (out / "mutation.diff").write_bytes(subprocess.check_output(["git", "diff", "--", str(target)]))
    cmd = [str(tools/"journey"),name]
    if name != "mutant-timeout":
        cmd.append("warm")
    rc = subprocess.run(cmd).returncode
    print(name, "full command exit", rc, flush=True)
finally:
    target.write_bytes(before)
    subprocess.run(["git", "diff", "--exit-code", "HEAD", "--",str(target)],check=True)
    print("Restored", target, subprocess.check_output(["git","hash-object",str(target)],text=True).strip(),flush=True)
sys.exit(0 if rc == 1 else 1)
