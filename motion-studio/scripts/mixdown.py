#!/usr/bin/env python3
"""
Sample-accurate audio mixdown for a composition's sound cues (used by scripts/mix.mjs).

    python3 -I scripts/mixdown.py events.json out.wav [--bus sfx] [--ceiling -1.0]

events.json: { "duration": s, "tracks": [ { "file": abs path, "at": s, "volume": lin, "from": s, "dur": s,
                                            "pan": -1..1, "bus": "sfx" } ] }
Places every cue at its exact sample, applies gain / trim (+40 ms fade) / pan and sums. The master is a
transparent look-ahead limiter at the ceiling (unity gain otherwise, no make-up). No loudness normalisation:
this is a STEM, meant to be balanced against the music by the editor. Prints peak, integrated and max
short-term (3 s) loudness.
"""
import argparse
import json

import numpy as np
import pyloudnorm as pyln
from pedalboard.io import AudioFile

SR = 48000


def load(path, cache={}):
    if path not in cache:
        with AudioFile(path) as f:
            if f.samplerate != SR:
                f = f.resampled_to(SR)
            x = f.read(f.frames)
        if x.shape[0] == 1:
            x = np.vstack([x, x])
        cache[path] = x.astype(np.float64)
    return cache[path]


def limit(x, ceiling, look_ms=2.0, release_ms=80.0):
    """Transparent look-ahead peak limiter: unity gain unless a peak would pass the ceiling (no make-up gain)."""
    from scipy.ndimage import maximum_filter1d
    peak = np.abs(x).max(axis=0)
    if peak.max() <= ceiling:
        return x
    la = max(1, int(SR * look_ms / 1000))
    env = maximum_filter1d(peak, size=2 * la + 1)
    target = np.minimum(1.0, ceiling / np.maximum(env, 1e-9))
    rel = np.exp(-1.0 / (SR * release_ms / 1000))
    g = np.empty_like(target)
    cur = 1.0
    for i in range(len(target)):                 # instant attack (look-ahead covers it), smooth release
        cur = target[i] if target[i] < cur else rel * cur + (1 - rel) * target[i]
        g[i] = cur
    return x * g


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("events")
    ap.add_argument("out")
    ap.add_argument("--bus", default=None, help="only tracks of this bus")
    ap.add_argument("--ceiling", type=float, default=-1.0, help="limiter ceiling (dBFS)")
    a = ap.parse_args()

    ev = json.load(open(a.events))
    n = int(round(ev["duration"] * SR))
    mix = np.zeros((2, n))
    used = 0
    for tr in ev["tracks"]:
        if a.bus and tr.get("bus", "sfx") != a.bus:
            continue
        x = load(tr["file"])
        start = int(round(tr.get("from", 0) * SR))
        x = x[:, start:]
        if tr.get("dur"):
            m = min(x.shape[1], int(round(tr["dur"] * SR)))
            x = x[:, :m].copy()
            f = min(m, int(0.04 * SR))
            x[:, m - f:] *= np.linspace(1, 0, f)
        x = x * tr.get("volume", 1.0)
        p = tr.get("pan", 0)
        if p:
            ang = (p + 1) * np.pi / 4
            x = np.stack([x[0] * np.cos(ang) * np.sqrt(2), x[1] * np.sin(ang) * np.sqrt(2)])
        i = int(round(tr["at"] * SR))
        if i >= n:
            continue
        j = min(n, i + x.shape[1])
        mix[:, i:j] += x[:, : j - i]
        used += 1

    raw_peak = 20 * np.log10(np.abs(mix).max() + 1e-12)
    out = limit(mix, 10 ** (a.ceiling / 20)).astype(np.float32)
    with AudioFile(a.out, "w", SR, 2, bit_depth=24) as f:
        f.write(out)
    peak = 20 * np.log10(np.abs(out).max() + 1e-12)
    meter = pyln.Meter(SR)
    try:
        lufs = meter.integrated_loudness(out.T.astype(np.float64))
    except Exception:
        lufs = float("nan")
    hop, win = SR // 2, 3 * SR
    st = [meter.integrated_loudness(out[:, i:i + win].T.astype(np.float64)) for i in range(0, max(1, out.shape[1] - win), hop)] or [lufs]
    print(json.dumps({"cues": used, "raw_peak_db": round(float(raw_peak), 1), "peak_db": round(float(peak), 1),
                      "lufs": round(float(lufs), 1), "max_st_lufs": round(float(max(st)), 1)}))


if __name__ == "__main__":
    main()
