"""Read-only comparison, run from the root of the detached checkout."""
import json
from collections import Counter
from pathlib import Path

lock = json.loads(Path("package-lock.json").read_text())["packages"]
installed = json.loads(Path("node_modules/.package-lock.json").read_text())["packages"]
missing = []
for key, entry in lock.items():
    if not key or entry.get("optional") or key in installed:
        continue
    if not (Path(key) / "package.json").is_file():
        missing.append(key)
print("Missing non-optional lockfile entries:", len(missing))
print("By workspace:", dict(sorted(Counter(k.split("/")[1] for k in missing).items())))
for key in missing:
    print(f'{key}: locked={lock[key]["version"]}, package.json absent')
raise SystemExit(1 if missing else 0)
