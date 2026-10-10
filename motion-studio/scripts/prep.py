#!/usr/bin/env python3
"""
Prepare a talking-head video for the split-screen editor (lib/talk.js).

    python3 -I scripts/prep.py raw.mp4 --name mi-video [--glossary "Cloud Code=Claude Code;Cloud=Claude"]
                               [--gap 0.4] [--pad 0.08] [--no-cut] [--theme fyg|ref] [--music tema.mp3]

Creates comps/<name>/ with:
  index.html     the composition (engine: /lib/talk.js)
  plan.json      edit plan: layouts, B-roll, overlays, captions (auto draft — refine it by hand)
  words.json     word-level transcript on the edited timeline
  meta.json      fps, duration, face position, cut list
  transcript.txt readable transcript with timestamps (to write the plan)
  media/voice.wav, media/frames/00000.jpg …   edited speaker audio + frames

Steps: Parakeet ASR (sherpa-onnx, word timestamps) → glossary fixes → silence cut (jump cuts)
→ edited speaker video → face detection (framing) → frame sequence → draft plan.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.path.expanduser("~/.cache/motion-studio/models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8")
MODEL_URL = "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8.tar.bz2"
SR = 16000


def sh(args, binary=False):
    r = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if r.returncode != 0:
        sys.exit(f"command failed: {' '.join(args[:6])}…\n{r.stderr.decode(errors='ignore')[-2500:]}")
    return r.stdout if binary else r.stdout.decode(errors="ignore")


def log(msg):
    print(msg, flush=True)


# ------------------------------------------------------------------ probe / audio
def probe(path):
    info = json.loads(sh(["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", path]))
    v = next(s for s in info["streams"] if s["codec_type"] == "video")
    w, h = int(v["width"]), int(v["height"])
    for sd in v.get("side_data_list", []) or []:
        if abs(int(sd.get("rotation", 0) or 0)) == 90:
            w, h = h, w
    return {"width": w, "height": h, "duration": float(info["format"]["duration"])}


def load_wav(path):
    with wave.open(path) as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0


def silences(wav_path, noise="-35dB", dur=0.3):
    out = subprocess.run(["ffmpeg", "-i", wav_path, "-af", f"silencedetect=noise={noise}:d={dur}", "-f", "null", "-"],
                         stderr=subprocess.PIPE, stdout=subprocess.DEVNULL).stderr.decode(errors="ignore")
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", out)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", out)]
    return list(zip(starts, ends))


# ------------------------------------------------------------------ ASR
def ensure_model():
    if os.path.exists(os.path.join(MODEL_DIR, "encoder.int8.onnx")):
        return
    log(f"· downloading ASR model (~490 MB, one time) from {MODEL_URL}")
    parent = os.path.dirname(MODEL_DIR)
    os.makedirs(parent, exist_ok=True)
    tar = os.path.join(parent, "model.tar.bz2")
    sh(["curl", "-sS", "-L", "-o", tar, MODEL_URL])
    sh(["tar", "-xjf", tar, "-C", parent])
    os.remove(tar)


def transcribe(wav_path):
    import sherpa_onnx
    ensure_model()
    d = MODEL_DIR
    rec = sherpa_onnx.OfflineRecognizer.from_transducer(
        encoder=f"{d}/encoder.int8.onnx", decoder=f"{d}/decoder.int8.onnx", joiner=f"{d}/joiner.int8.onnx",
        tokens=f"{d}/tokens.txt", num_threads=os.cpu_count() or 4, model_type="nemo_transducer",
        decoding_method="greedy_search")
    x = load_wav(wav_path)
    total = len(x) / SR
    # chunk at silences, ~20 s per chunk (the encoder is happiest with short windows)
    sil = silences(wav_path)
    bounds, start = [0.0], 0.0
    while total - start > 28:
        cands = [(a + b) / 2 for a, b in sil if start + 8 < (a + b) / 2 < start + 28]
        cut = min(cands, key=lambda m: abs(m - (start + 20))) if cands else start + 28
        bounds.append(cut)
        start = cut
    bounds.append(total)

    words = []
    for a, b in zip(bounds, bounds[1:]):
        s = rec.create_stream()
        s.accept_waveform(SR, x[int(a * SR): int(b * SR)])
        rec.decode_stream(s)
        r = s.result
        durs = list(r.durations) if getattr(r, "durations", None) else [0.08] * len(r.tokens)
        cur = None
        for tok, ts, du in zip(r.tokens, r.timestamps, durs):
            t0, t1 = a + ts, a + ts + max(du, 0.06)
            if tok.startswith(" ") or cur is None:
                if cur:
                    words.append(cur)
                cur = {"w": tok.strip(), "s": t0, "e": t1}
            else:
                cur["w"] += tok
                cur["e"] = t1
        if cur:
            words.append(cur)
    # punctuation-only tokens glue to the previous word
    merged = []
    for w in words:
        if merged and re.fullmatch(r"[.,;:!?¡¿…\"')\]]+", w["w"]) and not w["w"].startswith(("¿", "¡")):
            merged[-1]["w"] += w["w"]
            merged[-1]["e"] = max(merged[-1]["e"], w["e"])
        elif w["w"]:
            merged.append(w)
    for i in range(len(merged) - 1):
        merged[i]["e"] = min(merged[i]["e"], merged[i + 1]["s"])
    return merged


def clean(w):
    return re.sub(r"[^\wáéíóúüñ$%€]", "", w.lower())


def apply_glossary(words, glossary):
    """glossary: 'Cloud Code=Claude Code;Cloud=Claude' — longest phrases first, case-insensitive."""
    rules = []
    for item in filter(None, [g.strip() for g in (glossary or "").split(";")]):
        src, dst = [p.strip() for p in item.split("=", 1)]
        rules.append(([clean(t) for t in src.split()], dst.split()))
    rules.sort(key=lambda r: -len(r[0]))
    out, i = [], 0
    while i < len(words):
        for src, dst in rules:
            n = len(src)
            if [clean(w["w"]) for w in words[i: i + n]] == src:
                tail = re.search(r"[.,;:!?…]+$", words[i + n - 1]["w"])
                seg = words[i: i + n]
                span = (seg[-1]["e"] - seg[0]["s"]) / len(dst)
                for k, t in enumerate(dst):
                    out.append({"w": t + (tail.group(0) if tail and k == len(dst) - 1 else ""),
                                "s": seg[0]["s"] + k * span, "e": seg[0]["s"] + (k + 1) * span, "fix": True})
                i += n
                break
        else:
            out.append(words[i])
            i += 1
    return out


# ------------------------------------------------------------------ cut
def cut_segments(words, duration, gap, pad):
    if not words:
        return [(0.0, duration)]
    segs, a, prev = [], max(0.0, words[0]["s"] - pad), words[0]
    for w in words[1:]:
        if w["s"] - prev["e"] > gap:
            segs.append((a, min(duration, prev["e"] + pad)))
            a = max(0.0, w["s"] - pad)
        prev = w
    segs.append((a, min(duration, prev["e"] + pad)))
    merged = []
    for s in segs:
        if merged and s[0] <= merged[-1][1] + 0.02:
            merged[-1] = (merged[-1][0], max(merged[-1][1], s[1]))
        else:
            merged.append(s)
    return merged


def render_speaker(raw, segs, fps, out_mp4, out_wav, tmp):
    """Concatenate kept segments (8 ms audio fades at joins → no clicks)."""
    script = os.path.join(tmp, "cut.ffscript")
    parts, labels = [], []
    for i, (a, b) in enumerate(segs):
        d = b - a
        parts.append(f"[0:v]trim=start={a:.3f}:end={b:.3f},setpts=PTS-STARTPTS[v{i}];")
        parts.append(f"[0:a]atrim=start={a:.3f}:end={b:.3f},asetpts=PTS-STARTPTS,"
                     f"afade=t=in:st=0:d=0.008,afade=t=out:st={max(0, d - 0.008):.3f}:d=0.008[a{i}];")
        labels.append(f"[v{i}][a{i}]")
    parts.append("".join(labels) + f"concat=n={len(segs)}:v=1:a=1[cv][ca];[cv]fps={fps}[v]")
    with open(script, "w") as fh:
        fh.write("".join(parts))
    sh(["ffmpeg", "-v", "error", "-y", "-i", raw, "-filter_complex_script", script, "-map", "[v]", "-map", "[ca]",
        "-c:v", "libx264", "-crf", "16", "-preset", "fast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", out_mp4])
    sh(["ffmpeg", "-v", "error", "-y", "-i", out_mp4, "-vn", "-ac", "1", "-ar", "48000", "-c:a", "pcm_s16le", out_wav])


def remap(words, segs):
    out, offset = [], 0.0
    for a, b in segs:
        for w in words:
            if a - 0.001 <= w["s"] < b:
                out.append({**w, "s": round(w["s"] - a + offset, 3), "e": round(min(w["e"], b) - a + offset, 3)})
        offset += b - a
    return out


# ------------------------------------------------------------------ face
def detect_face(video):
    import cv2
    cascade = cv2.CascadeClassifier(os.path.join(cv2.data.haarcascades, "haarcascade_frontalface_default.xml"))
    raw = sh(["ffmpeg", "-v", "error", "-i", video, "-vf", "fps=2,scale=480:-2,format=gray", "-f", "rawvideo", "-"], binary=True)
    p = probe(video)
    w, h = 480, int(round(480 * p["height"] / p["width"] / 2) * 2)
    n = len(raw) // (w * h)
    pts = []
    for i in range(n):
        f = np.frombuffer(raw[i * w * h: (i + 1) * w * h], dtype=np.uint8).reshape(h, w)
        faces = cascade.detectMultiScale(f, scaleFactor=1.1, minNeighbors=6, minSize=(w // 12, w // 12))
        if len(faces):
            x, y, fw, fh = max(faces, key=lambda r: r[2] * r[3])
            pts.append(((x + fw / 2) / w, (y + fh / 2) / h, fw / w))
    if not pts:
        return {"x": 0.5, "y": 0.4, "size": 0.3, "found": 0}
    a = np.array(pts)
    return {"x": round(float(np.median(a[:, 0])), 4), "y": round(float(np.median(a[:, 1])), 4),
            "size": round(float(np.median(a[:, 2])), 4), "found": len(pts), "sampled": n}


# ------------------------------------------------------------------ draft plan
STOP = set("el la los las un una unos unas de del al a en y o que se te me lo le les es por para con sin su sus mi tu "
           "como más mas pero si no ya muy este esta eso esto ese esa hay ha he".split())


def is_break(w):
    return bool(re.search(r"[.?!:;,…]$", w["w"]))


def caption_chunks(words, max_chars=16, max_words=3):
    chunks, cur = [], []
    for i, w in enumerate(words):
        text = " ".join(x["w"] for x in cur + [w])
        gap = w["s"] - words[i - 1]["e"] if i else 0
        if cur and (len(text) > max_chars or len(cur) >= max_words or gap > 0.25 or is_break(words[i - 1])):
            chunks.append(cur)
            cur = []
        cur.append({**w, "i": i})
    if cur:
        chunks.append(cur)
    out = []
    for k, c in enumerate(chunks):
        end = chunks[k + 1][0]["s"] if k + 1 < len(chunks) else c[-1]["e"] + 0.4
        if end - c[-1]["e"] > 0.6:
            end = c[-1]["e"] + 0.3
        out.append({"s": round(c[0]["s"], 3), "e": round(end, 3), "words": [x["i"] for x in c]})
    return out


def auto_highlights(words, glossary_dst):
    hl = []
    for i, w in enumerate(words):
        c = clean(w["w"])
        prev_break = i == 0 or re.search(r"[.?!]$", words[i - 1]["w"])
        if re.search(r"\d", c) or w.get("fix") or (w["w"][:1].isupper() and not prev_break and c not in STOP) \
                or c in glossary_dst:
            hl.append(i)
    return hl


def beats(words, min_d=1.4, max_d=3.4):
    """Group words into visual beats (one layout / B-roll each), cutting at clause ends."""
    out, cur = [], []
    for i, w in enumerate(words):
        cur.append(i)
        d = words[cur[-1]]["e"] - words[cur[0]]["s"]
        nxt_gap = words[i + 1]["s"] - w["e"] if i + 1 < len(words) else 9
        if (d >= min_d and (is_break(w) or nxt_gap > 0.2)) or d >= max_d:
            out.append(cur)
            cur = []
    if cur:
        if out and words[cur[-1]]["e"] - words[cur[0]]["s"] < min_d:
            out[-1] += cur
        else:
            out.append(cur)
    return out


def short_phrase(ws, n=5):
    content = [w for w in ws if clean(w["w"]) not in STOP] or ws
    return " ".join(re.sub(r"[.,;:!?¿¡…]", "", w["w"]) for w in content[:n])


def draft_plan(words, duration, theme):
    groups = beats(words)
    cycle = ["split", "split", "speaker", "split", "broll", "split", "speaker", "split"]
    segments, t_prev = [], 0.0
    for k, g in enumerate(groups):
        ws = [words[i] for i in g]
        start = 0.0 if k == 0 else round(ws[0]["s"], 3)
        if segments:
            segments[-1]["end"] = start
        layout = "hook" if k == 0 else cycle[(k - 1) % len(cycle)]
        seg = {"start": start, "end": None, "layout": layout,
               "say": " ".join(w["w"] for w in ws)}
        if layout == "hook":
            # title = the first spoken words up to the first clause break (max 4); the rest types in as subtitle
            n = next((j + 1 for j, w in enumerate(ws[:4]) if is_break(w)), min(3, len(ws)))
            seg["title"] = " ".join(w["w"] for w in ws[:n])
            seg["titleWords"] = n
        elif layout in ("split", "broll"):
            seg["broll"] = {"type": "title", "text": short_phrase(ws, 4)}
        elif layout == "speaker" and k % 2 == 0:
            key = max(ws, key=lambda w: len(clean(w["w"])) if clean(w["w"]) not in STOP else 0)
            seg["overlay"] = {"text": re.sub(r"[.,;:!?¿¡…]", "", key["w"]), "style": "serif"}
        if k and k % 5 == 0:
            seg["transition"] = "zoom" if k % 10 == 0 else "leak"
        segments.append(seg)
        t_prev = start
    if segments:
        segments[-1]["end"] = round(duration, 3)
    return segments


THEMES = {
    "fyg": {"accent": "#C8F135", "accent2": "#F7D1DE", "ink": "#1A0A12", "brand": "#631336",
            "light": "#F3EEF0", "dark": "#120910", "sans": "Montserrat", "serif": "Instrument Serif"},
    "ref": {"accent": "#E8793A", "accent2": "#FFFFFF", "ink": "#111111", "brand": "#E8793A",
            "light": "#ECECEE", "dark": "#0B0B0D", "sans": "Montserrat", "serif": "Instrument Serif"},
}

INDEX_HTML = """<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>{name}</title>
<link rel="stylesheet" href="/lib/talk.css">
</head>
<body>
<div id="stage"></div>
<script src="/node_modules/gsap/dist/gsap.min.js"></script>
<script src="/node_modules/gsap/dist/CustomEase.min.js"></script>
<script src="/node_modules/gsap/dist/SplitText.min.js"></script>
<script src="/node_modules/gsap/dist/DrawSVGPlugin.min.js"></script>
<script src="/node_modules/gsap/dist/ScrambleTextPlugin.min.js"></script>
<script src="/lib/presets.js"></script>
<script src="/lib/runtime.js"></script>
<script src="/lib/talk.js"></script>
</body>
</html>
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--name", required=True)
    ap.add_argument("--glossary", default="")
    ap.add_argument("--gap", type=float, default=0.4, help="silences longer than this are cut (s)")
    ap.add_argument("--pad", type=float, default=0.08, help="breathing room kept around speech (s)")
    ap.add_argument("--no-cut", action="store_true")
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--theme", default="fyg", choices=sorted(THEMES))
    ap.add_argument("--music", default="", help="optional music bed (copied into media/)")
    ap.add_argument("--force", action="store_true", help="overwrite an existing plan.json")
    a = ap.parse_args()

    raw = os.path.abspath(a.video)
    comp = os.path.join(ROOT, "comps", a.name)
    media = os.path.join(comp, "media")
    frames_dir = os.path.join(media, "frames")
    os.makedirs(media, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix="prep-")
    try:
        info = probe(raw)
        log(f"· source {info['width']}x{info['height']} · {info['duration']:.1f}s")

        wav16 = os.path.join(tmp, "a16.wav")
        sh(["ffmpeg", "-v", "error", "-y", "-i", raw, "-vn", "-ac", "1", "-ar", str(SR), "-c:a", "pcm_s16le", wav16])
        log("· transcribing (Parakeet TDT v3)…")
        words = transcribe(wav16)
        words = apply_glossary(words, a.glossary)
        log(f"  {len(words)} words")

        segs = [(0.0, info["duration"])] if a.no_cut else cut_segments(words, info["duration"], a.gap, a.pad)
        kept = sum(b - x for x, b in segs)
        log(f"· cut: {len(segs)} segments · {info['duration']:.1f}s → {kept:.1f}s ({100 * (1 - kept / info['duration']):.0f}% removed)")
        speaker = os.path.join(media, "speaker.mp4")
        render_speaker(raw, segs, a.fps, speaker, os.path.join(media, "voice.wav"), tmp)
        words = remap(words, segs)

        log("· detecting face…")
        face = detect_face(speaker)
        log(f"  face at x={face['x']} y={face['y']} size={face['size']} ({face['found']} detections)")

        log("· extracting frames…")
        if os.path.isdir(frames_dir):
            shutil.rmtree(frames_dir)
        os.makedirs(frames_dir)
        sp = probe(speaker)
        scale = "scale='if(gt(iw,ih),min(1920,iw),-2)':'if(gt(iw,ih),-2,min(1920,ih))'"
        sh(["ffmpeg", "-v", "error", "-y", "-i", speaker, "-vf", scale, "-q:v", "3", "-start_number", "0",
            os.path.join(frames_dir, "%05d.jpg")])
        n_frames = len(os.listdir(frames_dir))
        duration = round(n_frames / a.fps, 3)

        music = ""
        if a.music:
            music = "media/" + os.path.basename(a.music)
            shutil.copy(a.music, os.path.join(comp, music))

        meta = {"name": a.name, "fps": a.fps, "duration": duration, "frames": n_frames,
                "width": sp["width"], "height": sp["height"], "face": face, "source": os.path.basename(raw),
                "cut": [[round(x, 3), round(b, 3)] for x, b in segs], "glossary": a.glossary}
        glossary_dst = {clean(t) for item in a.glossary.split(";") if "=" in item for t in item.split("=", 1)[1].split()}
        captions = caption_chunks(words)
        plan_path = os.path.join(comp, "plan.json")
        if os.path.exists(plan_path) and not a.force:
            log("· plan.json exists — kept (use --force to regenerate the draft)")
        else:
            plan = {"theme": THEMES[a.theme], "music": music, "musicVolume": 0.12, "sfx": True,
                    "highlights": auto_highlights(words, glossary_dst), "segments": draft_plan(words, duration, a.theme)}
            with open(plan_path, "w") as fh:
                json.dump(plan, fh, indent=2, ensure_ascii=False)
        with open(os.path.join(comp, "words.json"), "w") as fh:
            json.dump({"words": words, "captions": captions}, fh, ensure_ascii=False)
        with open(os.path.join(comp, "meta.json"), "w") as fh:
            json.dump(meta, fh, indent=2)
        index = os.path.join(comp, "index.html")
        if not os.path.exists(index):
            with open(index, "w") as fh:
                fh.write(INDEX_HTML.format(name=a.name))

        lines = []
        for c in captions:
            lines.append(f"{c['s']:7.2f}  " + " ".join(words[i]["w"] for i in c["words"]))
        with open(os.path.join(comp, "transcript.txt"), "w") as fh:
            fh.write("\n".join(lines) + "\n")
        log(f"✔ comps/{a.name}/ ready · {duration}s · {n_frames} frames")
        log("  next: edit plan.json, then  node scripts/render.mjs comps/" + a.name)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
