#!/usr/bin/env python3
"""
Professional UI / motion SFX library — fully synthesised (no samples, no licences: 100% owned, safe for ads).

    python3 -I scripts/sfxlib.py            # → assets/sfx/pro/*.wav (48 kHz, 24-bit, stereo) + manifest.json

Design rules (see 20-knowledge/motion-design/sonido-profesional-para-motion.md):
  • one tonal family: every pitched sound is tuned to C-major pentatonic, so cues harmonise with each other
    and sit with most music beds;
  • UI cues are short (30–150 ms), notifications ≤ ~500 ms + tail; rumble below ~120 Hz is removed except on
    impacts; harsh 2–5 kHz peaks are avoided;
  • several variations per frequent cue (pop, key, whoosh…) so repeats never sound machine-gunned;
  • stereo follows the screen: sent messages lean right, received lean left, swipes travel right → left.
Every file is peak-normalised to -1 dBFS; levels are set per cue when mixing.
"""
import json
import os

import numpy as np
import scipy.signal as ss
from pedalboard import Pedalboard, Reverb, Compressor, HighpassFilter, LowpassFilter
from pedalboard.io import AudioFile

SR = 48000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "sfx", "pro")
NOTE = {"C5": 523.25, "D5": 587.33, "E5": 659.26, "G5": 783.99, "A5": 880.0, "C6": 1046.5, "D6": 1174.66,
        "E6": 1318.51, "G6": 1567.98, "A6": 1760.0, "C7": 2093.0, "D7": 2349.32, "E7": 2637.02, "G7": 3135.96, "A7": 3520.0}
rng = np.random.default_rng(20261010)


# ------------------------------------------------------------------ primitives
def tt(dur):
    return np.arange(int(round(dur * SR))) / SR


def env(dur, attack=0.002, tau=0.05, hold=0.0):
    t = tt(dur)
    e = np.where(t < attack, t / max(attack, 1e-6), np.exp(-np.maximum(0, t - attack - hold) / tau))
    e[(t >= attack) & (t < attack + hold)] = 1.0
    return e


def swell(dur, peak=0.5, sharp=2.0):
    """Smooth rise to `peak` (0–1 of duration) then fall: whoosh amplitude shape."""
    x = np.linspace(0, 1, int(round(dur * SR)))
    up = np.sin(np.clip(x / peak, 0, 1) * np.pi / 2) ** sharp
    down = np.cos(np.clip((x - peak) / (1 - peak), 0, 1) * np.pi / 2) ** sharp
    return np.where(x < peak, up, down)


def osc(freq, dur, phase=0.0):
    """Sine with time-varying frequency (array or scalar)."""
    f = np.broadcast_to(np.asarray(freq, dtype=float), (int(round(dur * SR)),))
    return np.sin(2 * np.pi * np.cumsum(f) / SR + phase)


def glide(f0, f1, dur, tau=None):
    t = tt(dur)
    if tau is None:
        return f0 * (f1 / f0) ** (t / dur)
    return f1 + (f0 - f1) * np.exp(-t / tau)


def noise(dur, color="white"):
    n = int(round(dur * SR))
    w = rng.standard_normal(n)
    if color == "pink":   # Voss-ish: 1/f via filtering white noise
        b, a = [0.049922035, -0.095993537, 0.050612699, -0.004408786], [1, -2.494956002, 2.017265875, -0.522189400]
        w = ss.lfilter(b, a, w)
    return w / (np.abs(w).max() + 1e-9)


def filt(x, kind, f, order=2):
    sos = ss.butter(order, f, btype=kind, fs=SR, output="sos")
    return ss.sosfilt(sos, x)


def _rbj(kind, f, q):
    w0 = 2 * np.pi * min(f, SR * 0.45) / SR
    c, a_ = np.cos(w0), np.sin(w0) / (2 * q)
    if kind == "bp":
        b = [a_, 0, -a_]
    elif kind == "hp":
        b = [(1 + c) / 2, -(1 + c), (1 + c) / 2]
    else:
        b = [(1 - c) / 2, 1 - c, (1 - c) / 2]
    a = [1 + a_, -2 * c, 1 - a_]
    return np.array(b) / a[0], np.array(a) / a[0]


def sweep(x, freqs, q=1.5, kind="bp", block=96):
    """Time-varying biquad. `freqs`: callable p∈[0,1] → Hz, or (f0, f1) for a log sweep."""
    n = len(x)
    nb = (n + block - 1) // block
    p = np.linspace(0, 1, nb)
    fs = freqs(p) if callable(freqs) else freqs[0] * (freqs[1] / freqs[0]) ** p
    out, zi = np.zeros(n), np.zeros(2)
    for i in range(nb):
        b, a = _rbj(kind, fs[i], q)
        seg = x[i * block:(i + 1) * block]
        y, zi = ss.lfilter(b, a, seg, zi=zi)
        out[i * block:i * block + len(seg)] = y
    return out


def place(dst, src, at):
    i = int(round(at * SR))
    j = min(len(dst), i + len(src))
    if i < len(dst):
        dst[i:j] += src[:j - i]
    return dst


def pan(mono, p):
    """Equal-power pan; p scalar or array in [-1, 1]. Returns (2, n)."""
    p = np.broadcast_to(np.asarray(p, dtype=float), mono.shape)
    ang = (p + 1) * np.pi / 4
    return np.stack([mono * np.cos(ang), mono * np.sin(ang)])


def noise2(dur, color="white", corr=0.65):
    """Stereo noise: shared + independent part per channel. Wide on headphones, smooth when summed to mono
    (a Haas delay would comb-filter — and phone speakers are mono)."""
    common = noise(dur, color)
    return np.stack([np.sqrt(corr) * common + np.sqrt(1 - corr) * noise(dur, color),
                     np.sqrt(corr) * common + np.sqrt(1 - corr) * noise(dur, color)])


def each(fn, st, *a, **k):
    return np.stack([fn(ch, *a, **k) for ch in st])


def fx(st, *plugins, tail=0.0):
    x = np.concatenate([st, np.zeros((2, int(tail * SR)))], axis=1).astype(np.float32)
    return Pedalboard(list(plugins))(x, SR).astype(np.float64)


def room(size=0.25, wet=0.1, damp=0.6, width=0.9):
    return Reverb(room_size=size, wet_level=wet, dry_level=1.0, damping=damp, width=width)


def finish(st, peak_db=-1.0, fade=0.012, floor_db=-66):
    a = np.abs(st).max(axis=0)
    thr = a.max() * 10 ** (floor_db / 20)
    idx = np.where(a > thr)[0]
    st = st[:, : (idx[-1] + 1 if len(idx) else st.shape[1])]
    n = min(int(fade * SR), st.shape[1])
    st[:, -n:] *= np.linspace(1, 0, n) ** 2
    st[:, :32] *= np.linspace(0, 1, 32)           # no click at the start
    st *= 10 ** (peak_db / 20) / (np.abs(st).max() + 1e-12)
    return st


MANIFEST = {}


def save(name, st):
    os.makedirs(OUT, exist_ok=True)
    st = finish(st)
    with AudioFile(os.path.join(OUT, name + ".wav"), "w", SR, 2, bit_depth=24) as f:
        f.write(st.astype(np.float32))
    base = name.rsplit("-", 1)[0] if name.rsplit("-", 1)[-1].isdigit() else name
    MANIFEST[base] = MANIFEST.get(base, 0) + 1
    MANIFEST.setdefault("_dur", {})[name] = round(st.shape[1] / SR, 3)


# ------------------------------------------------------------------ sounds
def make_pop():
    for k, note in enumerate(["G5", "A5", "C6", "D6"], 1):
        d, f0 = 0.2, NOTE[note]
        tone = osc(f0 * (1 + 0.55 * np.exp(-tt(d) / 0.012)), d) * env(d, 0.0015, 0.045)
        tone += 0.18 * osc(2 * f0, d) * env(d, 0.001, 0.018)
        click = filt(noise(d), "highpass", 3500) * env(d, 0.0003, 0.0016) * 0.22
        st = pan(tone + click, 0)
        save(f"pop-{k}", fx(st, HighpassFilter(150), LowpassFilter(9500), room(0.15, 0.06), tail=0.2))


def make_send():
    for k, (lo, hi, note) in enumerate([(700, 3400, "E6"), (650, 3100, "D6"), (750, 3700, "G6")], 1):
        d = 0.26
        air = sweep(noise(d), (lo, hi), q=2.2) * swell(d, 0.42, 1.5) * 0.9
        blip = place(np.zeros(int(d * SR)), osc(NOTE[note], 0.09) * env(0.09, 0.002, 0.03) * 0.35, 0.085)
        st = pan(air + blip, 0.28)
        save(f"send-{k}", fx(st, HighpassFilter(250), room(0.18, 0.06), tail=0.25))


def fm_bell(f, dur, ratio=1.4, index=2.2, tau=0.14):
    t = tt(dur)
    mod = index * np.exp(-t / 0.08) * np.sin(2 * np.pi * f * ratio * t)
    return np.sin(2 * np.pi * f * t + mod) * env(dur, 0.002, tau)


def make_receive():
    for k, (n1, n2) in enumerate([("C6", "E6"), ("G5", "C6"), ("D6", "G6")], 1):
        d = 0.7
        x = np.zeros(int(d * SR))
        place(x, fm_bell(NOTE[n1], 0.5) * 0.8, 0.0)
        place(x, fm_bell(NOTE[n2], 0.6), 0.075)
        st = pan(x, -0.28)
        save(f"receive-{k}", fx(st, HighpassFilter(300), LowpassFilter(9000), room(0.32, 0.13), tail=0.5))


def make_key():
    for k in range(1, 7):
        d = 0.09
        thock = sweep(noise(d), (rng.uniform(170, 260),) * 2, q=4.0) * env(d, 0.0008, 0.009) * 1.6
        plastic = filt(noise(d), "bandpass", [1700, 2700]) * env(d, 0.0004, 0.004) * 0.45
        click = filt(noise(d), "highpass", 4200) * env(d, 0.0002, 0.0012) * 0.35
        st = pan((thock + plastic + click) * rng.uniform(0.85, 1.0), rng.uniform(-0.12, 0.12))
        save(f"key-{k}", fx(st, HighpassFilter(90), room(0.08, 0.04), tail=0.08))


def make_toggle():
    for k, (f0, f1) in enumerate([(700, 1046.5), (784, 1174.66)], 1):
        d = 0.18
        x = np.zeros(int(d * SR))
        c = lambda fc, amp: filt(noise(0.02), "bandpass", [fc * 0.8, fc * 1.25]) * env(0.02, 0.0003, 0.003) * amp
        place(x, c(1200, 0.9), 0.0)
        place(x, c(2400, 0.7), 0.038)
        place(x, osc(glide(f0, f1, 0.07), 0.07) * env(0.07, 0.003, 0.03) * 0.28, 0.03)
        save(f"toggle-{k}", fx(pan(x, 0.05), HighpassFilter(200), room(0.12, 0.05), tail=0.12))


def metal(dur, parts, taus, amp=1.0):
    t = tt(dur)
    return amp * sum(np.sin(2 * np.pi * f * t) * np.exp(-t / tau) for f, tau in zip(parts, taus))


def make_lock():
    for k, shift in enumerate([1.0, 1.08], 1):
        d = 0.2
        x = np.zeros(int(d * SR))
        hit = metal(0.08, [1880 * shift, 3020 * shift, 4410 * shift], [0.010, 0.005, 0.003]) * 0.5
        hit += filt(noise(0.08), "highpass", 2500) * env(0.08, 0.0002, 0.002) * 0.5
        thunk = osc(glide(180, 120, 0.06), 0.06) * env(0.06, 0.001, 0.02) * 0.7
        place(x, hit + np.pad(thunk, (0, len(hit) - len(thunk))), 0.0)
        place(x, hit * 0.45, 0.024)
        save(f"lock-{k}", fx(pan(x, 0.1), HighpassFilter(110), LowpassFilter(7000), room(0.14, 0.05), tail=0.15))


def make_check():
    for k, (n1, n2) in enumerate([("D6", "G6"), ("E6", "A6")], 1):
        d = 0.55
        x = np.zeros(int(d * SR))
        tone = lambda f: (osc(f, 0.3) + 0.12 * osc(3 * f, 0.3)) * env(0.3, 0.003, 0.085)
        place(x, tone(NOTE[n1]) * 0.75, 0.0)
        place(x, tone(NOTE[n2]), 0.055)
        place(x, filt(noise(0.25), "highpass", 8000) * env(0.25, 0.01, 0.05) * 0.06, 0.05)
        save(f"check-{k}", fx(pan(x, 0), HighpassFilter(400), LowpassFilter(11000), room(0.35, 0.15), tail=0.4))


def make_whoosh():
    for k, (f0, f1, d) in enumerate([(350, 2200, 0.32), (300, 1900, 0.36), (420, 2600, 0.3)], 1):
        st = each(sweep, noise2(d, "pink"), (f0, f1), q=1.1) * swell(d, 0.6, 1.6)
        save(f"whoosh-{k}", fx(st, HighpassFilter(200), room(0.2, 0.07), tail=0.2))


def make_swipe():
    for k, top in enumerate([2300, 2000], 1):
        d = 0.62
        curve = lambda p: 260 * (top / 260) ** np.sin(np.clip(p / 0.55, 0, 1) * np.pi / 2) * np.where(p > 0.55, (1300 / top) ** ((p - 0.55) / 0.45), 1)
        body = each(sweep, 0.7 * noise2(d, "pink") + 0.3 * noise2(d), curve, q=1.3) * swell(d, 0.5, 1.4)
        air = filt(noise(d, "pink"), "lowpass", 420) * swell(d, 0.5, 2.0) * 0.25
        zing = osc(glide(900, 520, d), d) * swell(d, 0.5, 2.0) * 0.03
        travel = np.linspace(0.55, -0.55, int(d * SR))           # new card arrives from the right
        st = body * np.stack([np.cos((travel + 1) * np.pi / 4), np.sin((travel + 1) * np.pi / 4)]) * np.sqrt(2) + pan(air + zing, 0)
        save(f"swipe-{k}", fx(st, HighpassFilter(120), LowpassFilter(9000), room(0.22, 0.08), tail=0.3))


def make_impact():
    d = 1.6
    t = tt(d)
    sub = osc(glide(70, 42, d, tau=0.14), d) * np.exp(-t / 0.22) * 0.45
    body = osc(glide(260, 150, d, tau=0.07), d) * np.exp(-t / 0.2) * 1.0           # 150–260 Hz: phones play this
    punch = osc(glide(520, 300, d, tau=0.04), d) * np.exp(-t / 0.07) * 0.45         # octave layer for small speakers
    thump = filt(noise(d), "bandpass", [300, 900]) * np.exp(-t / 0.06) * 0.8
    crack = filt(noise(d), "bandpass", [1200, 4000]) * np.exp(-t / 0.014) * 0.5
    x = np.tanh(2.6 * (sub + body + punch + thump + crack)) / np.tanh(2.6)        # harmonics = audible punch
    st = pan(x, 0)
    save("impact-1", fx(st, HighpassFilter(28), Compressor(threshold_db=-14, ratio=3, attack_ms=3, release_ms=120),
                        room(0.82, 0.32, damp=0.5), tail=1.2))


def make_riser():
    d = 0.85
    t = tt(d)
    shape = (t / d) ** 2.2
    st = each(sweep, noise2(d), (300, 5000), q=0.9, kind="hp") * shape
    st += pan(osc(glide(220, 880, d), d) * shape * 0.12, 0)
    st[:, -int(0.01 * SR):] *= np.linspace(1, 0, int(0.01 * SR))
    save("riser-1", fx(st, HighpassFilter(200), LowpassFilter(12000), room(0.3, 0.12)))


def make_swish():
    for k, (lo, hi, d) in enumerate([(4000, 10000, 0.22), (3500, 9000, 0.25), (4500, 11000, 0.2)], 1):
        st = each(filt, noise2(d), "bandpass", [lo, hi]) * swell(d, 0.45, 1.8)
        save(f"swish-{k}", fx(st, room(0.15, 0.06), tail=0.1))


def make_scramble():
    d = 0.95
    x = np.zeros(int(d * SR))
    notes = [NOTE[n] for n in ["C6", "D6", "E6", "G6", "A6"]]
    tpos = 0.0
    while tpos < d - 0.03:
        f = notes[rng.integers(len(notes))]
        b = (osc(f, 0.014) + 0.25 * osc(3 * f, 0.014)) * env(0.014, 0.0005, 0.005) * rng.uniform(0.35, 1.0)
        place(x, b, tpos)
        tpos += rng.uniform(0.022, 0.034)
    x *= swell(d, 0.2, 1.0) ** 0.5
    save("scramble-1", fx(pan(x, 0), LowpassFilter(6000), HighpassFilter(600), room(0.12, 0.05)))


def make_scribble():
    d = 1.8
    x = np.zeros(int(d * SR))
    tpos = 0.0
    while tpos < d - 0.1:
        sd = rng.uniform(0.09, 0.22)
        stroke = sweep(noise(sd, "pink"), (rng.uniform(900, 1400), rng.uniform(1900, 2900)), q=0.8) * swell(sd, rng.uniform(0.3, 0.6), 1.2)
        place(x, stroke * rng.uniform(0.6, 1.0), tpos)
        tpos += sd + rng.uniform(0.015, 0.05)
    x += filt(noise(d), "highpass", 6000) * 0.03
    save("scribble-1", fx(pan(x, 0.05), HighpassFilter(500), LowpassFilter(5000), room(0.1, 0.04)))


def make_notify():
    d = 0.95
    x = np.zeros(int(d * SR))
    mar = lambda f: (osc(f, 0.6) * env(0.6, 0.002, 0.16) + 0.35 * osc(4 * f, 0.6) * env(0.6, 0.001, 0.035))
    place(x, mar(NOTE["D6"]) * 0.8, 0.0)
    place(x, mar(NOTE["A6"]), 0.11)
    save("notify-1", fx(pan(x, 0), HighpassFilter(300), LowpassFilter(10000), room(0.42, 0.18), tail=0.5))


def make_buzz():
    d = 0.32
    x = np.zeros(int(d * SR))
    sq = lambda dur: np.sign(osc(196.0, dur)) * env(dur, 0.004, 0.05)
    place(x, sq(0.09), 0.0)
    place(x, sq(0.09), 0.13)
    x = filt(x, "lowpass", 1300)
    save("buzz-1", fx(pan(x, 0), HighpassFilter(150), room(0.15, 0.05), tail=0.1))


def make_shimmer():
    d = 1.4
    x = np.zeros((2, int(d * SR)))
    for i, n in enumerate(["C6", "E6", "G6", "A6", "C7"]):
        b = fm_bell(NOTE[n], 0.7, ratio=2.0, index=1.2, tau=0.25) * (0.6 + 0.1 * i)
        seg = pan(b, -0.5 + 0.25 * i)
        off = int(i * 0.05 * SR)
        n = min(seg.shape[1], x.shape[1] - off)
        x[:, off:off + n] += seg[:, :n]
    x += pan(filt(noise(d), "highpass", 7000) * env(d, 0.05, 0.4) * 0.05, 0)
    save("shimmer-1", fx(x, HighpassFilter(400), room(0.62, 0.3), tail=0.8))


def make_click():
    d = 0.07
    x = filt(noise(d), "highpass", 2500) * env(d, 0.0002, 0.0015) * 0.6
    x += filt(noise(d), "bandpass", [2600, 3600]) * env(d, 0.0003, 0.003) * 0.5
    x += osc(glide(260, 200, d), d) * env(d, 0.001, 0.01) * 0.18
    save("click-1", fx(pan(x, 0), HighpassFilter(150), room(0.08, 0.04), tail=0.05))


if __name__ == "__main__":
    for make in [make_pop, make_send, make_receive, make_key, make_toggle, make_lock, make_check, make_whoosh,
                 make_swipe, make_impact, make_riser, make_swish, make_scramble, make_scribble, make_notify,
                 make_buzz, make_shimmer, make_click]:
        make()
    with open(os.path.join(OUT, "manifest.json"), "w") as fh:
        json.dump(MANIFEST, fh, indent=1)
    print("✔", sum(v for k, v in MANIFEST.items() if k != "_dur"), "sounds →", os.path.relpath(OUT, ROOT))
    print({k: v for k, v in MANIFEST.items() if k != "_dur"})
