#!/usr/bin/env python3
"""
Add a B-roll asset to a talk project.

    python3 -I scripts/asset.py comps/<name> grabacion.mp4 [--as demo] [--fps 30] [--start 2.5] [--dur 6]
    python3 -I scripts/asset.py comps/<name> captura.png

Images are copied to comps/<name>/assets/.  Videos become frame sequences in comps/<name>/media/broll/<as>/
(+ info.json) so the renderer can seek them frame-accurately. Use them in plan.json:
    { "type": "image", "src": "assets/captura.png", "motion": "scroll" }
    { "type": "clip",  "src": "media/broll/demo", "from": 0, "speed": 1 }
"""
import argparse
import json
import os
import shutil
import subprocess
import sys


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("comp")
    ap.add_argument("file")
    ap.add_argument("--as", dest="name")
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--start", type=float, default=0)
    ap.add_argument("--dur", type=float, default=0)
    ap.add_argument("--width", type=int, default=1080, help="frame width (keeps aspect)")
    a = ap.parse_args()

    comp = os.path.abspath(a.comp)
    if not os.path.exists(os.path.join(comp, "plan.json")):
        sys.exit(f"not a talk project: {comp}")
    stem = a.name or os.path.splitext(os.path.basename(a.file))[0].lower().replace(" ", "-")
    ext = os.path.splitext(a.file)[1].lower()

    if ext in (".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"):
        dst = os.path.join(comp, "assets")
        os.makedirs(dst, exist_ok=True)
        out = os.path.join(dst, stem + ext)
        shutil.copy(a.file, out)
        print(f'✔ image → {{ "type": "image", "src": "assets/{stem + ext}" }}')
        return

    out = os.path.join(comp, "media", "broll", stem)
    if os.path.isdir(out):
        shutil.rmtree(out)
    os.makedirs(out)
    cmd = ["ffmpeg", "-v", "error", "-y"]
    if a.start:
        cmd += ["-ss", str(a.start)]
    if a.dur:
        cmd += ["-t", str(a.dur)]
    cmd += ["-i", a.file, "-vf", f"fps={a.fps},scale='min({a.width},iw)':-2", "-q:v", "3", "-start_number", "0",
            os.path.join(out, "%05d.jpg")]
    r = subprocess.run(cmd, stderr=subprocess.PIPE)
    if r.returncode:
        sys.exit(r.stderr.decode(errors="ignore")[-1500:])
    n = len([f for f in os.listdir(out) if f.endswith(".jpg")])
    with open(os.path.join(out, "info.json"), "w") as fh:
        json.dump({"fps": a.fps, "frames": n, "duration": round(n / a.fps, 3)}, fh)
    print(f'✔ clip ({n} frames, {n / a.fps:.1f}s) → {{ "type": "clip", "src": "media/broll/{stem}" }}')


if __name__ == "__main__":
    main()
