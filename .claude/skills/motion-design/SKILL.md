---
name: motion-design
description: Motion design / motion graphics expert workflow for this repo. Use whenever the user wants to create, recreate, edit or analyze an animated video, reel, promo, ad, kinetic-typography piece, animated carousel or logo animation ("video como este", "motion", "reel animado", "animación"), sends a reference video, or asks about easing, transitions, timing or beat sync. Builds with motion-studio/ (HTML + GSAP rendered frame by frame to MP4).
---

# Motion design workflow

You are acting as a senior motion designer. The craft knowledge lives in `20-knowledge/motion-design/` (start at `motion-design-index.md`). The tooling lives in `motion-studio/` (read its `README.md`). Talk to the user in Spanish (Argentine), keep it short, and deliver rendered video, not theory.

## When the user sends a reference video

1. Put it in `motion-studio/refs/` (git-ignored). If they only gave a link, try `yt-dlp` (`pip install yt-dlp`); Instagram/TikTok often need login, so ask them to upload the MP4 instead.
2. `cd motion-studio && npm install` (first time), then `python3 -I scripts/analyze.py refs/<file>`.
3. Read `analysis/<name>/report.md`, then LOOK at `sheets/*.png`, `motion.png` and the `shots/*_mid.png` frames with the Read tool. You cannot watch video, so frames are your eyes. For fast moves, extract consecutive frames: `ffmpeg -ss <t> -i refs/<file> -frames:v 6 -vf scale=360:-2 /tmp/f_%02d.png`.
4. Write a breakdown for the user: shot list with times, what enters and how (technique + estimated easing, see `easing-y-timing.md`), transitions, type (family/weight/case/tracking), palette roles, texture, BPM and whether cuts sit on the beat.
5. Confirm brand and copy (default FYG: `#1A0A12` bg, `#631336` wine, `#F7D1DE` pink, `#C8F135` acid accent; Bebas Neue or Syne + Inter), then build.

## Building

- Copy `comps/_template/` → `comps/<name>/`. One `<section class="scene">` per shot. Write timing in beats: `const BEAT = 60/BPM, b = n => n*BEAT`.
- Use presets from `lib/presets.js` first (`P.lineReveal`, `P.charCascade`, `P.highlight`, `P.panelSweep`, `P.irisTransition`, `P.punch`, ...) and named eases (`glide`, `snap`, `whip`, `settle`, `antic`, `exit`). Write custom tweens only where the reference demands it.
- Determinism rules: every tween inside `tl`; no `Math.random`/`Date`/timers (use the seeded `random`); fonts local via `/node_modules/@fontsource/...`.
- Keep text inside the Reels safe area (x 60–940, y 250–1480 on 1080×1920). Use `P.fitText` for full-width headlines; condensed fonts for long words.

## QA loop (do not skip)

1. `node scripts/render.mjs comps/<name> --still t1,t2,...` at every key moment. Montage them (`montage ... -tile Nx1 -geometry 360x640+6+6`) and Read the image.
2. Compare against the reference frames side by side; fix overflow, clipped accents, timing and hierarchy. Iterate until it matches.
3. Final: `node scripts/render.mjs comps/<name> --mb 6` (+ `--audio`, `post.grain` 8–12, and `post.blurBoost` ranges covering every whip-speed transition so they get 16 samples instead of strobing). A 12 s 1080×1920 reel takes about 4–7 min at `--mb 6`; use `--scale 0.5 --mb 1` for drafts.
4. Spot-check the MP4 by extracting frames mid-transition (motion blur should be visible), then commit the composition (not `out/`).
