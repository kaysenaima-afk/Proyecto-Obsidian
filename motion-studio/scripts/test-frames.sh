#!/usr/bin/env bash
# Regression test: renders comps/_framecheck (time encoded as binary bars, with 1-frame blur-boost chunks)
# and checks that every non-blurred output frame shows exactly its own timestamp. Exit 1 on any drift/drop.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=$(mktemp -d)
node scripts/render.mjs comps/_framecheck --out "$OUT/fc.mp4" >/dev/null
ffmpeg -v error -i "$OUT/fc.mp4" -vf format=gray -f rawvideo "$OUT/fc.raw"
python3 -I - "$OUT/fc.raw" <<'PY'
import sys, numpy as np
a = np.fromfile(sys.argv[1], np.uint8).reshape(-1, 400, 1080)
boosted = set(range(30, 46)) | set(range(78, 88)) | {100, 105}
bad = [n for n, f in enumerate(a) if n not in boosted and
       sum(1 << (15 - i) for i in range(16) if f[200, i * 66 + 30] > 128) != round(n / 30 * 1000)]
ok = len(a) == 120 and not bad
print(f"frames {len(a)}/120 · mismatched {bad[:10]} → {'OK' if ok else 'FAIL'}")
sys.exit(0 if ok else 1)
PY
rm -rf "$OUT"
