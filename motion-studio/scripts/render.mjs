#!/usr/bin/env node
/*
 * Frame-accurate renderer: HTML composition → MP4 (or ProRes 4444 with alpha).
 *
 *   node scripts/render.mjs comps/fyg-demo                       # final, 30fps, H.264
 *   node scripts/render.mjs comps/fyg-demo --mb 6                # + true motion blur (6 subframes)
 *   node scripts/render.mjs comps/fyg-demo --scale 0.5 --mb 1    # fast draft
 *   node scripts/render.mjs comps/fyg-demo --still 0.5,2,4.25    # PNG stills for review
 *   node scripts/render.mjs comps/fyg-demo --audio music.mp3 --audio-start 12.3
 *   node scripts/render.mjs comps/lower-third --alpha            # transparent .mov overlay
 *   node scripts/render.mjs comps/fyg-demo --grain 12            # film grain in post (0 = off)
 *   node scripts/render.mjs comps/fyg-demo --mb 6 --boost 16     # 16 samples inside post.blurBoost ranges
 *   node scripts/render.mjs comps/meta-carrusel --query slide=3   # extra URL params → out/meta-carrusel-slide-3.mp4
 *
 * A composition can set defaults with
 *   MotionComp.create({ post: { grain: 10, blurBoost: [[2.1, 2.5]], boostSamples: 16 } }).
 *
 * How it works: N headless Chromium pages each own a contiguous chunk of frames.
 * For every (sub)frame the page is seeked via window.__motion.seek(t) and
 * screenshotted over CDP; PNGs stream into a per-chunk ffmpeg that averages
 * subframes (tmix → motion blur) and writes a lossless segment. Segments are
 * concatenated and encoded once, with optional audio.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer, compUrlPath, ROOT } from '../lib/server.mjs';

// ------------------------------------------------------------------ args
const argv = process.argv.slice(2);
const opts = { _: [] };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) { opts._.push(a); continue; }
  const key = a.slice(2);
  const next = argv[i + 1];
  if (next === undefined || next.startsWith('--')) opts[key] = true; else { opts[key] = next; i++; }
}
if (!opts._[0] || opts.help) {
  console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0]);
  process.exit(opts._[0] ? 0 : 1);
}

const comp = compUrlPath(opts._[0]);
// --query "slide=3" passes extra URL params to the composition (one comp, several outputs).
const query = opts.query ? String(opts.query) : '';
const compName = path.basename(path.dirname(comp.abs)) + (query ? '-' + query.replace(/[^\w]+/g, '-') : '');
const scale = parseFloat(opts.scale ?? 1);
const sub = Math.max(1, parseInt(opts.mb ?? 1, 10));
const shutter = parseFloat(opts.shutter ?? 0.5);
const crf = String(opts.crf ?? 16);
const alpha = Boolean(opts.alpha);
const workers = Math.max(1, parseInt(opts.workers ?? Math.min(4, os.cpus().length), 10));

function run(cmd, args, { input } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: [input ? 'pipe' : 'ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d; if (err.length > 20000) err = err.slice(-20000); });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}\n${err.slice(-3000)}`))));
    if (input) input(p);
  });
}

// ------------------------------------------------------------------ browser
const { server, port } = await startServer();
const url = `http://127.0.0.1:${port}${comp.urlPath}?render=1${query ? '&' + query : ''}`;
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--force-color-profile=srgb', '--font-render-hinting=none', '--disable-lcd-text', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required'],
});

async function openPage(meta) {
  const context = await browser.newContext({
    viewport: meta ? { width: meta.width, height: meta.height } : { width: 1080, height: 1920 },
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error(`[page ${m.type()}]`, m.text()); });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__motion && window.__motion.ready, null, { timeout: 30000 });
  await page.evaluate(() => window.__motion.ready);
  const cdp = await context.newCDPSession(page);
  if (alpha) {
    await cdp.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
    // Page/stage backgrounds would make every pixel opaque; scenes keep their own backgrounds.
    await page.addStyleTag({ content: 'html, body, #stage { background: transparent !important; }' });
  }
  return { context, page, cdp, meta };
}

async function capture(p, t) {
  await p.page.evaluate((tt) => window.__motion.seek(tt), t);
  const shot = { format: 'png', optimizeForSpeed: true, captureBeyondViewport: false };
  // clip.scale is what actually changes the output resolution (deviceScaleFactor < 1 is ignored by CDP).
  if (p.meta) shot.clip = { x: 0, y: 0, width: p.meta.width, height: p.meta.height, scale };
  const { data } = await p.cdp.send('Page.captureScreenshot', shot);
  return Buffer.from(data, 'base64');
}

const probe = await openPage(null);
const meta = await probe.page.evaluate(() => ({
  width: window.__motion.width, height: window.__motion.height, fps: window.__motion.fps, duration: window.__motion.duration,
  post: window.__motion.post,
}));
await probe.context.close();

const fps = parseFloat(opts.fps ?? meta.fps);
const from = parseFloat(opts.from ?? 0);
const to = Math.min(parseFloat(opts.to ?? meta.duration), meta.duration);
const outW = Math.round(meta.width * scale), outH = Math.round(meta.height * scale);
// Grain is added in post (after motion blur) so tmix doesn't average it away, and it costs nothing to render.
const grain = Math.max(0, parseFloat(opts.grain ?? meta.post.grain ?? 0));
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });

// ------------------------------------------------------------------ stills
if (opts.still) {
  const times = String(opts.still === true ? '0' : opts.still).split(',').map(Number);
  const p = await openPage(meta);
  for (const t of times) {
    const file = path.join(ROOT, 'out', `${compName}-${t.toFixed(2)}s.png`);
    fs.writeFileSync(file, await capture(p, t));
    console.log('still →', path.relative(process.cwd(), file));
  }
  await browser.close(); server.close();
  process.exit(0);
}

// ------------------------------------------------------------------ video
const totalFrames = Math.max(1, Math.round((to - from) * fps));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `ms-${compName}-`));

// Blur boost: very fast moves (whip transitions) strobe into visible copies with few subframes.
// Like AE's adaptive motion blur, frames inside post.blurBoost ranges get more samples.
// Boost applies when motion blur is on, or always if the composition asks (post.alwaysBoost) — e.g. talk edits
// render without base blur but still want smeared whip transitions. --boost 0 disables it.
const boostRanges = (sub > 1 || meta.post.alwaysBoost) && opts.boost !== '0' ? (meta.post.blurBoost || []) : [];
const boostSamples = Math.max(sub, parseInt(opts.boost ?? meta.post.boostSamples ?? 12, 10) || sub);
const subAt = (f) => {
  const t = from + f / fps;
  return boostRanges.some(([a, b]) => t >= a && t <= b) ? boostSamples : sub;
};

// Chunks: contiguous frames with the same subframe count, split small enough to keep every worker busy.
const maxChunk = Math.max(8, Math.ceil(totalFrames / (workers * 2)));
const chunks = [];
for (let f = 0; f < totalFrames; f++) {
  const s = subAt(f), last = chunks[chunks.length - 1];
  if (last && last.sub === s && last.b - last.a < maxChunk) last.b++;
  else chunks.push({ a: f, b: f + 1, sub: s });
}
const boosted = chunks.filter((c) => c.sub > sub).reduce((n, c) => n + c.b - c.a, 0);

console.log(`▶ ${compName}: ${outW}x${outH} @ ${fps}fps · ${(to - from).toFixed(2)}s · ${totalFrames} frames` +
  ` · motion blur ${sub > 1 ? `${sub} subframes, ${Math.round(shutter * 360)}° shutter` : 'off'}` +
  (boosted ? ` (+${boosted} frames boosted to ${boostSamples})` : '') + ` · grain ${grain || 'off'} · ${workers} workers`);

let done = 0;
const started = Date.now();
const ticker = setInterval(() => {
  const el = (Date.now() - started) / 1000, rate = done / el;
  process.stdout.write(`\r  ${done}/${totalFrames} frames · ${rate.toFixed(1)} fps · ETA ${rate ? Math.round((totalFrames - done) / rate) : '?'}s   `);
}, 1000);

async function renderChunk(p, { a, b, sub: n }, idx) {
  // NUT keeps an exact 1/fps timebase (MKV rounds to ms and gives 1-frame segments zero duration).
  const seg = path.join(tmp, `seg_${String(idx).padStart(4, '0')}.nut`);
  const fmt = alpha ? 'rgba' : 'rgb24';
  // Stage 1 decodes the PNG stream to raw frames of ONE fixed pixel format. Chromium switches between RGB
  // and RGBA PNGs depending on content; fed straight into tmix, every switch re-initialised the filter
  // graph, reset the averaging window and silently dropped frames.
  const dec = spawn('ffmpeg', ['-v', 'error', '-f', 'image2pipe', '-c:v', 'png', '-i', '-',
    '-vf', `scale=${outW}:${outH}`, '-f', 'rawvideo', '-pix_fmt', fmt, '-'], { stdio: ['pipe', 'pipe', 'pipe'] });
  // Stage 2 averages subframes (motion blur) and writes a lossless segment.
  const args = ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', fmt, '-s', `${outW}x${outH}`,
    '-framerate', String(fps * n), '-i', '-'];
  if (n > 1) args.push('-vf', [`tmix=frames=${n}`, `select='eq(mod(n\\,${n})\\,${n - 1})'`, `setpts=N/(${fps}*TB)`].join(','));
  args.push('-r', String(fps), '-c:v', 'ffv1', '-pix_fmt', alpha ? 'bgra' : 'bgr0', seg);
  let decErr = '';
  dec.stderr.on('data', (d) => { decErr += d; });
  const decDone = new Promise((res, rej) => dec.on('close', (c) => (c === 0 ? res() : rej(new Error('png decode failed\n' + decErr.slice(-2000))))));
  await Promise.all([decDone, run('ffmpeg', args, {
    input: (proc) => {
      dec.stdout.pipe(proc.stdin);
      (async () => {
        try {
          for (let f = a; f < b; f++) {
            for (let s = 0; s < n; s++) {
              const offset = n > 1 ? ((s + 0.5) / n - 0.5) * shutter : 0;
              const t = Math.min(Math.max(from + (f + offset) / fps, 0), meta.duration);
              const png = await capture(p, t);
              if (!dec.stdin.write(png)) await new Promise((r) => dec.stdin.once('drain', r));
            }
            done++;
          }
        } catch (e) {
          console.error('\n[worker]', e);
          dec.kill('SIGKILL');
          proc.kill('SIGKILL');
        } finally {
          dec.stdin.end();
        }
      })();
    },
  })]);
  return seg;
}

try {
  const segs = new Array(chunks.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(workers, chunks.length) }, async () => {
    const p = await openPage(meta);
    while (next < chunks.length) {
      const i = next++;
      segs[i] = await renderChunk(p, chunks[i], i);
    }
    await p.context.close();
  }));
  clearInterval(ticker);
  process.stdout.write(`\r  ${totalFrames}/${totalFrames} frames · capture ${((Date.now() - started) / 1000).toFixed(1)}s            \n`);

  const list = path.join(tmp, 'list.txt');
  // Explicit per-segment durations: frame-exact concatenation whatever each container reports.
  fs.writeFileSync(list, segs.map((s, i) => `file '${s}'\nduration ${((chunks[i].b - chunks[i].a) / fps).toFixed(6)}`).join('\n'));
  const ext = alpha ? '.mov' : '.mp4';
  const out = path.resolve(opts.out ?? path.join(ROOT, 'out', compName + ext));
  fs.mkdirSync(path.dirname(out), { recursive: true });

  const args = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list];
  // Audio: --audio (one track) and/or post.audio declared by the composition
  // [{ src, at, volume, loop, from }] — src relative to the composition folder or absolute from ROOT ('/assets/…').
  const tracks = [];
  if (opts.audio) tracks.push({ file: path.resolve(opts.audio), at: 0, volume: parseFloat(opts.volume ?? 1), from: parseFloat(opts['audio-start'] ?? 0) });
  for (const tr of meta.post.audio || []) {
    const file = tr.src.startsWith('/') ? path.join(ROOT, tr.src) : path.join(path.dirname(comp.abs), tr.src);
    if (!fs.existsSync(file)) { console.warn(`[audio] missing ${tr.src}`); continue; }
    tracks.push({ file, at: tr.at ?? 0, volume: tr.volume ?? 1, loop: tr.loop, from: tr.from ?? 0, dur: tr.dur });
  }
  for (const tr of tracks) {
    if (tr.loop) args.push('-stream_loop', '-1');
    if (tr.from) args.push('-ss', String(tr.from));
    args.push('-i', tr.file);
  }
  const dur = (to - from).toFixed(3);
  const toYuv = 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p';
  if (alpha) {
    args.push('-map', '0:v', '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-vendor', 'apl0');
  } else {
    if (grain) {
      // Filmic grain: animated noise generated at half resolution (clumpier, like film, and far more
      // compressible than per-pixel noise), upscaled and overlay-blended on luma only.
      const gw = Math.round(outW / 4) * 2, gh = Math.round(outH / 4) * 2;
      args.push('-filter_complex',
        `[0:v]${toYuv}[base];` +
        `color=c=0x808080:s=${gw}x${gh}:r=${fps}:d=${(to - from + 1).toFixed(3)},format=yuv420p,lutyuv=y=128:u=128:v=128,noise=c0s=60:c0f=t,` +
        `scale=${outW}:${outH}:flags=bicubic,format=yuv420p[g];` +
        `[base][g]blend=c0_mode=overlay:c0_opacity=${Math.min(1, grain / 40).toFixed(3)}:c1_mode=normal:c2_mode=normal:shortest=1[v]`,
        '-map', '[v]', '-tune', 'grain');
    } else {
      args.push('-map', '0:v', '-vf', toYuv);
    }
    args.push(
      '-c:v', 'libx264', '-preset', opts.preset ?? 'medium', '-crf', crf, '-profile:v', 'high',
      // Bitrate ceiling keeps grain/blur-heavy pieces at a sane delivery size (platforms re-encode anyway).
      '-maxrate', String(opts.maxrate ?? '20M'), '-bufsize', String(opts.bufsize ?? '30M'),
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
      '-movflags', '+faststart'
    );
  }
  if (tracks.length) {
    const fadeOut = Math.max(0, (to - from) - 0.5).toFixed(3);
    // Each track: shift to the render window, delay to its start, set its gain; then mix and normalise to
    // social loudness (-14 LUFS, -1 dBTP). A single track keeps its own level apart from the fade.
    const chains = tracks.map((tr, i) => {
      const shift = tr.at - from;
      const pre = shift < 0 ? `atrim=start=${(-shift).toFixed(3)},asetpts=PTS-STARTPTS,` : `adelay=${Math.round(shift * 1000)}:all=1,`;
      const cut = tr.dur ? `atrim=end=${tr.dur.toFixed(3)},afade=t=out:st=${Math.max(0, tr.dur - 0.04).toFixed(3)}:d=0.04,` : '';
      return `[${i + 1}:a]aformat=sample_rates=48000:channel_layouts=stereo,${cut}${pre}volume=${tr.volume}[a${i}]`;
    });
    const mix = tracks.length > 1
      ? `${tracks.map((_, i) => `[a${i}]`).join('')}amix=inputs=${tracks.length}:normalize=0:duration=longest,` +
        'loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000,alimiter=limit=0.89:level=false,'   // loudnorm runs at 192 kHz; limiter guarantees ≤ -1 dBTP
      : '[a0]';
    // apad: sparse SFX can end before the picture — pad with silence so audio = video length exactly.
    const graph = `${chains.join(';')};${mix}apad=whole_dur=${dur},atrim=end=${dur},afade=t=out:st=${fadeOut}:d=0.5[aout]`;
    const fcIdx = args.indexOf('-filter_complex');
    if (fcIdx >= 0) args[fcIdx + 1] += ';' + graph;
    else args.push('-filter_complex', graph);
    args.push('-map', '[aout]', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000');
  }
  args.push('-r', String(fps), '-frames:v', String(totalFrames), out);
  await run('ffmpeg', args);
  console.log(`✔ ${path.relative(process.cwd(), out)}  (${(fs.statSync(out).size / 1e6).toFixed(1)} MB, ${((Date.now() - started) / 1000).toFixed(1)}s total)`);
} finally {
  clearInterval(ticker);
  if (process.env.MS_KEEP_TMP) console.log('tmp kept:', tmp); else fs.rmSync(tmp, { recursive: true, force: true });
  await browser.close();
  server.close();
}
