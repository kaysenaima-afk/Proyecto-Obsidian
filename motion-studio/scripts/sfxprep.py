#!/usr/bin/env python3
"""
Recorded-quality SFX library: ElevenLabs text-to-sound generations → edited, mono-safe, phone-tested WAVs.

    python3 -I scripts/sfxprep.py              # assets/sfx/el/raw/<family>/*.mp3 → assets/sfx/el/<family>-N.wav
    python3 -I scripts/sfxprep.py --report     # + per-file analysis table

Why: the synthesized kit (scripts/sfxlib.py) is mostly pure tones (spectral flatness ≈ 0), it reads as "beeps".
Real foley has noise, texture and micro-variation. Each raw generation is edited like a sound editor would:
  1. trim the silence before the transient (sync must be frame-exact) and the dead tail, with a short fade;
  2. clean up: high-pass per family (no rumble on UI cues), optional low-pass to tame fizz above ~14 kHz;
  3. `punch`: parallel saturation of the low band so subby hits keep harmonics a phone speaker can play;
  4. stereo: narrow anything whose L/R correlation is low, so it does not cancel on mono phone speakers;
  5. variations: ±1–2 semitone resampled copies so repeated cues (pops, keys) never sound machine-gunned;
  6. peak-normalise to -1 dBFS (4× oversampled peak), 48 kHz / 24-bit stereo.
Levels are set per cue in the composition, not here. Prompts and generation ids live in raw/prompts.json.
"""
import json
import os
import subprocess
import sys
from fractions import Fraction

import numpy as np
import pyloudnorm as pyln
import scipy.signal as ss
from pedalboard.io import AudioFile

SR = 48000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, "assets", "sfx", "el")
RAW = os.path.join(BASE, "raw")

# family: sources (take letters, "family/letter" to borrow, or (letter, from_s, dur_s) to cut one event),
#         clean-up, variations (semitones applied to every source, in order)
#   hp/lp   Hz          gate  dB under peak where the sound "starts"     tail  dB under peak where it ends
#   max     s cap       width stereo width (1 = as recorded, 0 = mono)    punch saturation mix for low-band harmonics
#   gain    dB extra per source (balance a pair before normalising)
SPEC = {}


def spec(name, srcs, **kw):
    SPEC[name] = dict(srcs=srcs, hp=kw.get("hp", 80), lp=kw.get("lp", 16000), gate=kw.get("gate", -36),
                      tail=kw.get("tail", -56), max=kw.get("max", None), width=kw.get("width", 0.8),
                      punch=kw.get("punch", 0.0), vars=kw.get("vars", [0]), pre=kw.get("pre", 0.002),
                      fade=kw.get("fade", 0.04), start=kw.get("start", 0.0), slice=kw.get("slice", 0),
                      chain=kw.get("chain", None), fin=kw.get("fin", 0.0), stack=kw.get("stack", None))


# ------------------------------------------------------------------ I/O
def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).reshape(-1, 2).T.astype(np.float64)
    return x[:, : max(1, x.shape[1] - int(0.04 * SR))]       # the generator's MP3s end on a click: drop 40 ms


def save(path, x):
    with AudioFile(path, "w", SR, 2, bit_depth=24) as f:
        f.write(x.astype(np.float32))


# ------------------------------------------------------------------ edit steps
def env_db(x, hop=0.005):
    h = int(hop * SR)
    m = np.abs(x).max(axis=0)
    n = len(m) // h
    e = m[: n * h].reshape(n, h).max(axis=1)
    return 20 * np.log10(e + 1e-9), h


def trim(x, gate, tail, pre, fade, cap, start):
    if start:
        x = x[:, int(start * SR):]
    e, h = env_db(x)
    pk = e.max()
    on = int(np.argmax(e > pk + gate)) * h
    s = max(0, on - int(pre * SR))
    live = np.where(e > pk + tail)[0]
    end = min(x.shape[1], (live[-1] + 1) * h + int(0.02 * SR))
    if cap:
        end = min(end, s + int(cap * SR))
    y = x[:, s:end].copy()
    n = min(int(fade * SR), y.shape[1] // 2)
    y[:, -n:] *= np.cos(np.linspace(0, np.pi / 2, n)) ** 2
    k = min(int(0.0015 * SR), y.shape[1])
    y[:, :k] *= np.linspace(0, 1, k)        # declick the cut
    return y


def hits(x, n, quiet=-48, loud=-24):
    """Split a take with several separate hits (a few key presses) into the n strongest individual hits."""
    e, h = env_db(x)
    pk = e.max()
    segs, start, low = [], None, True
    for i, v in enumerate(e):
        if low and v > pk + loud:
            start, low = i, False
        elif not low and v < pk + quiet:
            segs.append((start, i))
            low = True
    if not low:
        segs.append((start, len(e)))
    segs = sorted(segs, key=lambda ab: -e[ab[0]:ab[1]].max())[:n]
    return [x[:, max(0, a * h - int(0.01 * SR)): b * h + int(0.03 * SR)] for a, b in sorted(segs)]


def chain(parts, xf=0.06):
    """Join takes end to end with equal-power crossfades: a continuous bed longer than any single take."""
    out, n = parts[0], int(xf * SR)
    for p in parts[1:]:
        k = min(n, out.shape[1] // 2, p.shape[1] // 2)
        a = np.cos(np.linspace(0, np.pi / 2, k))
        out = np.concatenate([out[:, :-k], out[:, -k:] * a + p[:, :k] * a[::-1], p[:, k:]], axis=1)
    return out


def loud_m(x):
    """Max momentary loudness (LUFS, 400 ms windows): how loud the cue feels. Compositions use it to place each
    cue at a target level instead of guessing volumes (short clicks top out around -22, chimes around -13)."""
    meter = pyln.Meter(SR, block_size=0.4)
    y = np.concatenate([np.zeros((2, int(0.2 * SR))), x, np.zeros((2, int(0.5 * SR)))], axis=1).T
    w, best = int(0.4 * SR), -70.0
    for s in range(0, y.shape[0] - w, int(0.05 * SR)):
        seg = y[s: s + w]
        if np.abs(seg).max() > 1e-5:
            best = max(best, meter.integrated_loudness(seg))
    return round(float(best), 1)


def peak_time(x):
    """Where the sound 'lands': first 5 ms block within 1.5 dB of the loudest one. Cues sync this to the frame."""
    e, h = env_db(x)
    return round(float(np.argmax(e >= e.max() - 1.5) * h / SR), 3)


def filt(x, hp, lp):
    if hp:
        x = ss.sosfiltfilt(ss.butter(2, hp, "highpass", fs=SR, output="sos"), x, axis=1)
    if lp and lp < SR / 2 - 100:
        x = ss.sosfiltfilt(ss.butter(2, lp, "lowpass", fs=SR, output="sos"), x, axis=1)
    return x


def punch(x, mix):
    """Parallel tanh saturation of 40–250 Hz, high-passed at 180 Hz: adds the 2nd–5th harmonics of a boom so
    a phone speaker (nothing below ~250 Hz) still 'hears' the weight."""
    if not mix:
        return x
    low = ss.sosfiltfilt(ss.butter(2, [40, 250], "bandpass", fs=SR, output="sos"), x, axis=1)
    g = 1 / (np.abs(low).max() + 1e-9)
    sat = np.tanh(low * g * 4) / np.tanh(4)
    sat = ss.sosfiltfilt(ss.butter(2, 180, "highpass", fs=SR, output="sos"), sat, axis=1)
    return x + mix * sat * np.abs(x).max()


def corr(x):
    if x[0].std() < 1e-9 or x[1].std() < 1e-9:
        return 1.0
    return float(np.corrcoef(x[0], x[1])[0, 1])


def width(x, w):
    c = corr(x)
    if c < 0.2:                              # wide / phasey generation: pull it in harder
        w = min(w, 0.45)
    m, s = (x[0] + x[1]) / 2, (x[0] - x[1]) / 2 * w
    return np.stack([m + s, m - s])


def shift(x, semis):
    """Tape-style varispeed (pitch and length move together, like a sampler): natural for foley."""
    if not semis:
        return x
    r = Fraction(2 ** (-semis / 12)).limit_denominator(200)
    return ss.resample_poly(x, r.numerator, r.denominator, axis=1)


def normalise(x, peak_db=-1.0):
    tp = np.abs(ss.resample_poly(x, 4, 1, axis=1)).max()
    return x * 10 ** (peak_db / 20) / (tp + 1e-12)


# ------------------------------------------------------------------ analysis
def analyse(x):
    m = x.mean(axis=0)
    e, h = env_db(x)
    live = np.zeros(len(m), bool)
    rep = np.repeat(e > e.max() - 30, h)
    live[: len(rep)] = rep
    act = live.sum() / SR
    rms = lambda v: 20 * np.log10(np.sqrt((v[live] ** 2).mean()) + 1e-12)
    band = ss.sosfiltfilt(ss.butter(4, [250, 8000], "bandpass", fs=SR, output="sos"), m)
    S = np.abs(np.fft.rfft(m * np.hanning(len(m)))) ** 2 + 1e-20
    f = np.fft.rfftfreq(len(m), 1 / SR)
    sp = np.abs(ss.stft(m, SR, nperseg=1024)[2]) ** 2
    fb = np.fft.rfftfreq(1024, 1 / SR)
    P = sp[(fb > 150) & (fb < 14000)] + 1e-20                 # flatness inside the band MP3 actually carries
    loud = P.sum(axis=0) > P.sum(axis=0).max() * 1e-3
    flat = float(np.median((np.exp(np.log(P).mean(axis=0)) / P.mean(axis=0))[loud]))
    return dict(dur=round(x.shape[1] / SR, 3), corr=round(corr(x), 2), rms=round(float(rms(m)), 1),
                phone=round(float(rms(m) - rms(band)), 1), cent=int((S * f).sum() / S.sum()),
                flat=round(flat, 3), active=round(float(act), 3))


# ------------------------------------------------------------------ library
def build(report=False):
    manifest, rows = {}, []
    for name, sp in SPEC.items():
        k = 0
        if sp["chain"]:                          # [[take, semitones], ...] → one bed
            parts = []
            for take, semis in sp["chain"]:
                y = load(os.path.join(RAW, name, f"{name}-{take}.mp3"))
                parts.append(shift(trim(y, sp["gate"], sp["tail"], 0.0, 0.03, None, 0), semis))
            x = width(filt(chain(parts), sp["hp"], sp["lp"]), sp["width"])
            k += 1
            y = normalise(x)
            save(os.path.join(BASE, f"{name}-{k}.wav"), y)
            manifest.setdefault("_dur", {})[f"{name}-{k}"] = round(y.shape[1] / SR, 3)
            manifest.setdefault("_peak", {})[f"{name}-{k}"] = 0.0
            manifest.setdefault("_lufs", {})[f"{name}-{k}"] = loud_m(y)
            rows.append((f"{name}-{k}", "bed", 0, analyse(y)))
        for layers in sp["stack"] or []:          # [("family/take", dB), ...] → one designed sound, transients aligned
            parts = []
            for src, db in layers:
                fam, _, take = src.rpartition("/")
                y = trim(load(os.path.join(RAW, fam, f"{fam}-{take}.mp3")), -30, sp["tail"], 0.001, sp["fade"], sp["max"], 0)
                parts.append((y * 10 ** (db / 20), peak_time(y)))
            lead = max(p for _, p in parts)
            n = max(int((lead - p) * SR) + y.shape[1] for y, p in parts)
            x = np.zeros((2, n))
            for y, p in parts:
                o = int((lead - p) * SR)
                x[:, o: o + y.shape[1]] += y
            x = width(punch(filt(x, sp["hp"], sp["lp"]), sp["punch"]), sp["width"])
            k += 1
            y = normalise(x)
            save(os.path.join(BASE, f"{name}-{k}.wav"), y)
            manifest.setdefault("_dur", {})[f"{name}-{k}"] = round(y.shape[1] / SR, 3)
            manifest.setdefault("_peak", {})[f"{name}-{k}"] = peak_time(y)
            manifest.setdefault("_lufs", {})[f"{name}-{k}"] = loud_m(y)
            rows.append((f"{name}-{k}", "stk", 0, analyse(y)))
        for src in sp["srcs"]:
            src, a, b = (src, 0, None) if isinstance(src, str) else src       # ("a", from_s, dur_s): one event of a take
            fam, _, take = src.rpartition("/")
            raw = load(os.path.join(RAW, fam or name, f"{fam or name}-{take}.mp3"))
            raw = raw[:, int(a * SR): int((a + b) * SR) if b else None]
            takes = hits(raw, sp["slice"]) if sp["slice"] else [raw]
            for x in takes:
                x = trim(x, sp["gate"], sp["tail"], sp["pre"], sp["fade"], sp["max"], sp["start"])
                if sp["fin"]:                           # shortened lead-in: ease into it instead of a hard cut
                    n = min(int(sp["fin"] * SR), x.shape[1])
                    x[:, :n] *= np.sin(np.linspace(0, np.pi / 2, n)) ** 2
                x = filt(x, sp["hp"], sp["lp"])
                x = punch(x, sp["punch"])
                x = width(x, sp["width"])
                for semis in sp["vars"]:
                    k += 1
                    y = normalise(shift(x, semis))
                    save(os.path.join(BASE, f"{name}-{k}.wav"), y)
                    a = analyse(y)
                    manifest.setdefault("_dur", {})[f"{name}-{k}"] = a["dur"]
                    manifest.setdefault("_peak", {})[f"{name}-{k}"] = peak_time(y)
                    manifest.setdefault("_lufs", {})[f"{name}-{k}"] = loud_m(y)
                    rows.append((f"{name}-{k}", src, semis, a))
        manifest[name] = k
    for f in os.listdir(BASE):                 # drop files left over from a bigger previous build
        if f.endswith(".wav"):
            fam, _, n = f[:-4].rpartition("-")
            if fam in manifest and n.isdigit() and int(n) > manifest[fam]:
                os.remove(os.path.join(BASE, f))
    with open(os.path.join(BASE, "manifest.json"), "w") as fh:
        json.dump(manifest, fh, indent=1, sort_keys=True)
    with open(os.path.join(BASE, "manifest.js"), "w") as fh:       # same data for compositions (no fetch needed)
        fh.write("// generated by scripts/sfxprep.py\nwindow.SFX_EL = " + json.dumps(manifest, sort_keys=True) + ";\n")
    if report:
        # rms = loudness while active (dBFS), phone = dB lost through a 250 Hz–8 kHz phone speaker
        print(f"{'file':14s} {'src':4s} {'st':>3s} {'peak':>5s} {'lufsM':>6s} {'dur':>6s} {'corr':>5s} {'rms':>6s} {'phone':>5s} {'cent':>6s} {'flat':>6s} {'active':>6s}")
        for n, s, st, a in rows:
            print(f"{n:14s} {s:4s} {st:+3d} {manifest['_peak'].get(n, 0):5.3f} {manifest['_lufs'][n]:6.1f} {a['dur']:6.3f} {a['corr']:5.2f} {a['rms']:6.1f} {a['phone']:5.1f} {a['cent']:6d} {a['flat']:6.3f} {a['active']:6.3f}")
    print(json.dumps({k: v for k, v in manifest.items() if not k.startswith("_")}))


# ------------------------------------------------------------------ the kit
spec("swipe", ["a", "b"], hp=110, gate=-30, tail=-50, max=0.9, width=0.85, fade=0.12)
spec("impact", [], hp=28, tail=-60, punch=0.35, width=0.9, fade=0.25, max=1.2,
     stack=[[("impact/a", 0), ("hit/b", -3)], [("impact/b", 0), ("hit/a", -4)]])
spec("riser", ["a", "b"], hp=120, gate=-40, tail=-46, width=0.7, fade=0.01, pre=0.0)
spec("send", ["a", "b"], hp=150, gate=-30, tail=-54, width=0.8)
spec("receive", ["a"], hp=200, gate=-30, tail=-54, width=0.6, vars=[0, 2])
spec("pop", ["a"], hp=150, gate=-30, tail=-44, width=0.6, vars=[0, 1, -1, 2], fade=0.06)
spec("key", ["a"], hp=200, gate=-30, tail=-50, width=0.6, slice=9, fade=0.015, max=0.14)
spec("toggle", ["a"], hp=180, gate=-30, tail=-42, width=0.6, vars=[0, 1], fade=0.04, max=0.3)
spec("check", ["a"], hp=200, gate=-30, tail=-48, width=0.75, vars=[0, 2, 4], fade=0.15, max=1.0)   # rising run
spec("notify", ["a"], hp=150, gate=-30, tail=-50, width=0.8, fade=0.15)
spec("scribble", [], hp=400, gate=-30, tail=-44, width=0.6, chain=[["a", 0], ["b", 0], ["a", -1], ["b", 1], ["a", 1]])
spec("swish", ["a", "b"], hp=300, gate=-30, tail=-46, width=0.7, start=0.3, fin=0.12, fade=0.1)
spec("buzz", ["a"], hp=90, gate=-30, tail=-46, width=0.6, max=0.5, fade=0.15, punch=0.9)
spec("shimmer", ["a"], hp=500, gate=-30, tail=-44, width=0.6, max=1.4, fade=0.4)
spec("scramble", [("a", 1.0, 1.0), ("a", 5.0, 1.0), ("a", 10.5, 1.0)], hp=600, lp=12000, gate=-40, tail=-60,
     width=0.6, fin=0.03, fade=0.3, pre=0.0)
spec("click", [("a", 0.54, 0.16), ("a", 0.80, 0.16), ("a", 1.09, 0.16), ("a", 1.52, 0.16)], hp=150, gate=-30,
     tail=-44, width=0.6, fade=0.04)
spec("lock", [("a", 0, 0.32), ("a", 0.98, 0.45)], hp=160, gate=-30, tail=-46, width=0.7, fade=0.06)

if __name__ == "__main__":
    build(report="--report" in sys.argv)
