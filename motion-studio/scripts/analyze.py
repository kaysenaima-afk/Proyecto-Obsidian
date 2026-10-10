#!/usr/bin/env python3
"""
Reference-video analyzer: turns a video into things a motion designer can read.

    python3 -I scripts/analyze.py refs/video.mp4 [--out analysis/video] [--step 0.25] [--threshold 0.28]

Outputs (in --out):
  report.md / report.json  metadata, pacing, shot list, palette, tempo, beat-sync score
  sheets/sheet_XX.png      contact sheets, one thumbnail every --step seconds, timestamped
  shots/shot_XX_{in,mid,out}.png   first / middle / last frame of every detected shot
  motion.png               motion-energy curve (frame difference) with cuts + audio onsets
  palette.png              dominant colors of the whole piece

Needs: ffmpeg/ffprobe, numpy, Pillow.
"""
import argparse
import json
import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont


def sh(args, binary=False):
    r = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if r.returncode != 0:
        sys.exit(f"command failed: {' '.join(args)}\n{r.stderr.decode(errors='ignore')[-2000:]}")
    return r.stdout if binary else r.stdout.decode()


def font(size):
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", "/System/Library/Fonts/Menlo.ttc",
              "/Library/Fonts/Arial.ttf", "C:/Windows/Fonts/consola.ttf"):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def probe(path):
    info = json.loads(sh(["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", path]))
    v = next(s for s in info["streams"] if s["codec_type"] == "video")
    a = next((s for s in info["streams"] if s["codec_type"] == "audio"), None)
    num, den = (v.get("avg_frame_rate") or v.get("r_frame_rate") or "30/1").split("/")
    fps = float(num) / float(den) if float(den) else 30.0
    w, h = int(v["width"]), int(v["height"])
    rot = 0
    for sd in v.get("side_data_list", []) or []:
        rot = int(sd.get("rotation", 0) or 0)
    if abs(rot) == 90:
        w, h = h, w
    dur = float(info["format"].get("duration") or v.get("duration") or 0)
    return {
        "width": w, "height": h, "fps": round(fps, 3), "duration": round(dur, 3), "video_codec": v.get("codec_name"),
        "bitrate_kbps": round(int(info["format"].get("bit_rate", 0)) / 1000), "has_audio": a is not None,
        "audio_codec": a.get("codec_name") if a else None, "aspect": f"{w}:{h}" if w and h else None,
    }


def gray_frames(path, fps, w=96):
    """Decode the whole video as tiny grayscale frames at native fps."""
    raw = sh(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={w}:-2,format=gray", "-f", "rawvideo", "-"], binary=True)
    probe_h = json.loads(sh(["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-select_streams", "v:0", path]))
    sw, shh = int(probe_h["streams"][0]["width"]), int(probe_h["streams"][0]["height"])
    h = int(round(w * shh / sw / 2) * 2)
    n = len(raw) // (w * h)
    return np.frombuffer(raw[: n * w * h], dtype=np.uint8).reshape(n, h, w).astype(np.float32)


def detect_cuts(frames, fps, threshold):
    """Cut = big frame difference that is also a local spike (robust to fast motion)."""
    if len(frames) < 2:
        return [], np.zeros(len(frames))
    diff = np.abs(np.diff(frames, axis=0)).mean(axis=(1, 2)) / 255.0
    energy = np.concatenate([[0.0], diff])
    # histogram difference catches cuts between similar-brightness shots
    hists = np.stack([np.histogram(f, bins=32, range=(0, 255))[0] for f in frames]).astype(np.float32)
    hists /= hists.sum(axis=1, keepdims=True) + 1e-9
    hdiff = np.concatenate([[0.0], 0.5 * np.abs(np.diff(hists, axis=0)).sum(axis=1)])
    score = 0.5 * hdiff + 0.5 * np.clip(energy * 4, 0, 1)
    cuts, min_gap = [], max(2, int(fps * 0.12))
    win = max(3, int(fps * 0.5))
    for i in range(1, len(score)):
        lo, hi = max(0, i - win), min(len(score), i + win + 1)
        local = np.median(score[lo:hi])
        if score[i] > threshold and score[i] > 2.2 * local + 0.02 and (not cuts or i - cuts[-1] >= min_gap):
            cuts.append(i)
    return [c / fps for c in cuts], energy


def audio_analysis(path, sr=11025):
    raw = sh(["ffmpeg", "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", str(sr), "-f", "s16le", "-"], binary=True)
    x = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    if len(x) < sr:
        return None
    hop, win = 256, 1024
    n = 1 + (len(x) - win) // hop
    idx = np.arange(win)[None, :] + hop * np.arange(n)[:, None]
    spec = np.abs(np.fft.rfft(x[idx] * np.hanning(win), axis=1))
    flux = np.maximum(0, np.diff(np.log1p(spec), axis=0)).sum(axis=1)
    flux = np.concatenate([[0], flux])
    flux = (flux - flux.mean()) / (flux.std() + 1e-9)
    frame_rate = sr / hop
    # onsets: local maxima above adaptive threshold
    onsets = []
    w = int(frame_rate * 0.05)
    for i in range(w, len(flux) - w):
        seg = flux[i - w: i + w + 1]
        if flux[i] == seg.max() and flux[i] > np.median(flux[max(0, i - 40): i + 40]) + 1.0:
            if not onsets or (i - onsets[-1]) > frame_rate * 0.09:
                onsets.append(i)
    onset_t = [(o * hop + win / 2) / sr for o in onsets]  # window centre
    # tempo via autocorrelation of onset envelope, 70–180 BPM
    env = np.maximum(flux, 0)
    ac = np.correlate(env, env, mode="full")[len(env) - 1:]
    lags = np.arange(len(ac)) / frame_rate
    mask = (lags >= 60 / 180) & (lags <= 60 / 70)
    bpm = None
    if mask.any():
        k = int(np.flatnonzero(mask)[np.argmax(ac[mask])])
        # parabolic interpolation around the peak → sub-hop lag precision
        if 0 < k < len(ac) - 1:
            y0, y1, y2 = ac[k - 1], ac[k], ac[k + 1]
            denom = y0 - 2 * y1 + y2
            k = k + (0.5 * (y0 - y2) / denom if denom else 0)
        bpm = round(60 / (k / frame_rate), 1)
    rms = np.sqrt((x[idx] ** 2).mean(axis=1))
    return {"bpm": bpm, "onsets": onset_t, "rms": rms, "rms_rate": frame_rate, "loudness_db": round(20 * math.log10(rms.mean() + 1e-9), 1)}


def extract_frame(path, t, out, width):
    sh(["ffmpeg", "-v", "error", "-y", "-ss", f"{max(0, t):.3f}", "-i", path, "-frames:v", "1", "-vf", f"scale={width}:-2", out])


def palette_of(img, k=6):
    q = img.convert("RGB").resize((160, int(160 * img.height / img.width))).quantize(colors=k, method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette()[: k * 3]
    counts = sorted(q.getcolors(), reverse=True)
    total = sum(c for c, _ in counts)
    return [{"hex": "#%02x%02x%02x" % tuple(pal[i * 3: i * 3 + 3]), "pct": round(100 * c / total, 1)} for c, i in counts]


def contact_sheets(path, meta, step, outdir):
    os.makedirs(outdir, exist_ok=True)
    tw = 216 if meta["height"] >= meta["width"] else 320
    tmp = os.path.join(outdir, "_thumbs")
    os.makedirs(tmp, exist_ok=True)
    sh(["ffmpeg", "-v", "error", "-y", "-i", path, "-vf", f"fps=1/{step},scale={tw}:-2", os.path.join(tmp, "t_%05d.png")])
    thumbs = sorted(os.listdir(tmp))
    cols, rows = (6, 3) if meta["height"] >= meta["width"] else (4, 4)
    per = cols * rows
    f = font(16)
    sheets = []
    for s in range(0, len(thumbs), per):
        batch = thumbs[s: s + per]
        im0 = Image.open(os.path.join(tmp, batch[0]))
        cw, ch = im0.width, im0.height + 26
        sheet = Image.new("RGB", (cols * cw + (cols + 1) * 6, rows * ch + (rows + 1) * 6), (24, 24, 28))
        d = ImageDraw.Draw(sheet)
        for j, name in enumerate(batch):
            im = Image.open(os.path.join(tmp, name)).convert("RGB")
            x, y = 6 + (j % cols) * (cw + 6), 6 + (j // cols) * (ch + 6)
            sheet.paste(im, (x, y + 26))
            t = (s + j) * step + step / 2
            d.text((x + 4, y + 4), f"{t:6.2f}s  f{int(t * meta['fps'])}", fill=(200, 241, 53), font=f)
        p = os.path.join(outdir, f"sheet_{len(sheets) + 1:02d}.png")
        sheet.save(p)
        sheets.append(p)
    for n in thumbs:
        os.remove(os.path.join(tmp, n))
    os.rmdir(tmp)
    return sheets


def motion_chart(energy, fps, cuts, onsets, out, duration):
    W, H, pad = 1600, 360, 40
    im = Image.new("RGB", (W, H), (18, 18, 22))
    d = ImageDraw.Draw(im)
    f = font(14)
    if len(energy) > 1:
        e = energy / (energy.max() + 1e-9)
        pts = [(pad + (i / fps) / duration * (W - 2 * pad), H - pad - v * (H - 2 * pad)) for i, v in enumerate(e)]
        d.line(pts, fill=(247, 209, 222), width=2)
    for t in onsets or []:
        x = pad + t / duration * (W - 2 * pad)
        d.line([(x, H - pad), (x, H - pad + 10)], fill=(90, 160, 255), width=2)
    for t in cuts:
        x = pad + t / duration * (W - 2 * pad)
        d.line([(x, pad), (x, H - pad)], fill=(200, 241, 53), width=2)
    for s in range(0, int(duration) + 1):
        x = pad + s / duration * (W - 2 * pad)
        d.text((x - 6, H - pad + 14), f"{s}s", fill=(150, 150, 150), font=f)
    d.text((pad, 10), "motion energy (pink) · cuts (green) · audio onsets (blue ticks)", fill=(220, 220, 220), font=f)
    im.save(out)


def palette_strip(colors, out):
    W, H = 1200, 160
    im = Image.new("RGB", (W, H), (0, 0, 0))
    d = ImageDraw.Draw(im)
    f = font(18)
    x = 0
    for c in colors:
        w = max(60, int(W * c["pct"] / 100))
        rgb = tuple(int(c["hex"][i: i + 2], 16) for i in (1, 3, 5))
        d.rectangle([x, 0, x + w, H], fill=rgb)
        lum = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
        d.text((x + 8, H - 48), f"{c['hex']}\n{c['pct']}%", fill=(0, 0, 0) if lum > 140 else (255, 255, 255), font=f)
        x += w
    im.save(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--out")
    ap.add_argument("--step", type=float, default=0.25, help="seconds between contact-sheet thumbnails")
    ap.add_argument("--threshold", type=float, default=0.28, help="cut sensitivity (lower = more cuts)")
    a = ap.parse_args()

    video = os.path.abspath(a.video)
    name = os.path.splitext(os.path.basename(video))[0]
    out = os.path.abspath(a.out or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "analysis", name))
    os.makedirs(os.path.join(out, "shots"), exist_ok=True)

    meta = probe(video)
    print(f"· {name}: {meta['width']}x{meta['height']} {meta['fps']}fps {meta['duration']}s audio={meta['has_audio']}")

    frames = gray_frames(video, meta["fps"])
    cuts, energy = detect_cuts(frames, meta["fps"], a.threshold)
    dur = meta["duration"] or len(frames) / meta["fps"]
    bounds = [0.0] + cuts + [dur]
    shots = [{"n": i + 1, "start": round(s, 3), "end": round(e, 3), "dur": round(e - s, 3)} for i, (s, e) in enumerate(zip(bounds, bounds[1:])) if e - s > 0.01]

    # motion character per shot: how much movement vs. holds
    for s in shots:
        i0, i1 = int(s["start"] * meta["fps"]) + 1, max(int(s["start"] * meta["fps"]) + 2, int(s["end"] * meta["fps"]))
        seg = energy[i0:i1]
        s["motion"] = round(float(seg.mean()) * 100, 2) if len(seg) else 0
        s["hold_pct"] = round(100 * float((seg < 0.002).mean()), 0) if len(seg) else 0

    print(f"· {len(shots)} shots detected")
    sheets = contact_sheets(video, meta, a.step, os.path.join(out, "sheets"))

    all_colors = {}
    for s in shots:
        for tag, t in (("in", s["start"] + 0.04), ("mid", (s["start"] + s["end"]) / 2), ("out", s["end"] - 0.06)):
            p = os.path.join(out, "shots", f"shot_{s['n']:02d}_{tag}.png")
            extract_frame(video, t, p, 540 if meta["height"] >= meta["width"] else 800)
        s["palette"] = palette_of(Image.open(os.path.join(out, "shots", f"shot_{s['n']:02d}_mid.png")))
        for c in s["palette"]:
            all_colors[c["hex"]] = all_colors.get(c["hex"], 0) + c["pct"] * s["dur"]
    tot = sum(all_colors.values()) or 1
    global_palette = sorted(({"hex": k, "pct": round(100 * v / tot, 1)} for k, v in all_colors.items()), key=lambda c: -c["pct"])[:8]
    palette_strip(global_palette, os.path.join(out, "palette.png"))

    audio = audio_analysis(video) if meta["has_audio"] else None
    onsets = audio["onsets"] if audio else []
    sync = None
    if audio and cuts:
        near = sum(1 for c in cuts if any(abs(c - o) <= 0.09 for o in onsets))
        sync = round(100 * near / len(cuts))
    motion_chart(energy, meta["fps"], cuts, onsets, os.path.join(out, "motion.png"), dur)

    durs = [s["dur"] for s in shots]
    pacing = {
        "shots": len(shots), "avg_shot": round(float(np.mean(durs)), 2), "median_shot": round(float(np.median(durs)), 2),
        "shortest": round(min(durs), 2), "longest": round(max(durs), 2), "cuts_per_10s": round(10 * len(cuts) / dur, 1),
        "first_cut": round(cuts[0], 2) if cuts else None,
    }
    report = {"file": os.path.basename(video), "meta": meta, "pacing": pacing, "global_palette": global_palette,
              "audio": {"bpm": audio["bpm"], "beat_s": round(60 / audio["bpm"], 3) if audio and audio["bpm"] else None,
                        "loudness_db": audio["loudness_db"], "onsets": [round(o, 3) for o in onsets[:400]],
                        "cuts_on_onsets_pct": sync} if audio else None,
              "cuts": [round(c, 3) for c in cuts], "shots": shots}
    with open(os.path.join(out, "report.json"), "w") as fh:
        json.dump(report, fh, indent=2)

    L = [f"# Analysis — {name}", "",
         f"- **Format:** {meta['width']}x{meta['height']} ({meta['aspect']}) · {meta['fps']} fps · {meta['duration']} s · {meta['video_codec']} {meta['bitrate_kbps']} kbps",
         f"- **Pacing:** {pacing['shots']} shots · avg {pacing['avg_shot']} s · median {pacing['median_shot']} s · {pacing['cuts_per_10s']} cuts/10s · first cut at {pacing['first_cut']} s"]
    if audio:
        L.append(f"- **Audio:** ~{audio['bpm']} BPM (beat = {report['audio']['beat_s']} s) · {len(onsets)} onsets · cuts on onsets: {sync}% · loudness {audio['loudness_db']} dBFS")
    L += ["- **Global palette:** " + " ".join(f"`{c['hex']}` {c['pct']}%" for c in global_palette), "",
          "## Shot list", "", "| # | start | end | dur | motion | hold % | palette |", "|---|---|---|---|---|---|---|"]
    for s in shots:
        L.append(f"| {s['n']} | {s['start']:.2f} | {s['end']:.2f} | {s['dur']:.2f} | {s['motion']} | {s['hold_pct']:.0f} | " + " ".join(c["hex"] for c in s["palette"][:4]) + " |")
    L += ["", "## Files", "", "- sheets/: " + ", ".join(os.path.basename(p) for p in sheets), "- shots/: in/mid/out frame per shot", "- motion.png, palette.png", ""]
    with open(os.path.join(out, "report.md"), "w") as fh:
        fh.write("\n".join(L))
    print(f"✔ report → {os.path.join(out, 'report.md')}")


if __name__ == "__main__":
    main()
