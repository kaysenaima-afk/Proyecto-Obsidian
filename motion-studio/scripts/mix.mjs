#!/usr/bin/env node
/*
 * Mix a composition's sound cues (post.audio) to a WAV stem — and optionally mux it onto an already
 * rendered video, so sound can be iterated without re-rendering a single frame.
 *
 *   node scripts/mix.mjs comps/meta-carrusel --query slide=3 --wav out/x/slide-03-sfx.wav \
 *        [--video out/x/slide-03.mp4 --mux out/x/slide-03-sfx.mp4] [--bus sfx] [--cues out/x/slide-03-cues.csv]
 *        [--space -20 | off]   shared room send in dB (default: the comp's post.space)
 */
import { chromium } from 'playwright-core';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer, compUrlPath, ROOT } from '../lib/server.mjs';

const argv = process.argv.slice(2);
const opts = { _: [] };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) { opts._.push(a); continue; }
  const next = argv[i + 1];
  if (next === undefined || next.startsWith('--')) opts[a.slice(2)] = true; else { opts[a.slice(2)] = next; i++; }
}
if (!opts._[0] || !opts.wav) { console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0]); process.exit(1); }

const comp = compUrlPath(opts._[0]);
const { server, port } = await startServer();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('pageerror', (e) => console.error('[page error]', e.message));
await page.goto(`http://127.0.0.1:${port}${comp.urlPath}?render=1${opts.query ? '&' + opts.query : ''}`);
await page.waitForFunction(() => window.__motion && window.__motion.ready, null, { timeout: 30000 });
await page.evaluate(() => window.__motion.ready);
const ev = await page.evaluate(() => ({ duration: window.__motion.duration, audio: window.__motion.post.audio || [], space: window.__motion.post.space }));
const space = opts.space !== undefined ? opts.space : ev.space;   // shared room send (dB): post.space in the comp
await browser.close();
server.close();

const tracks = ev.audio.map((t) => ({
  ...t,
  file: t.src.startsWith('/') ? path.join(ROOT, t.src) : path.join(path.dirname(comp.abs), t.src),
})).filter((t) => {
  if (!fs.existsSync(t.file)) { console.warn('[mix] missing', t.src); return false; }
  return true;
});
if (opts.cues) {   // cue sheet for editors: file start, landing frame (peak), sound, gain
  const rows = tracks.slice().sort((a, b) => a.at - b.at).map((t) =>
    [t.at.toFixed(3), (t.land ?? t.at).toFixed(3), path.basename(t.src, '.wav'), (20 * Math.log10(t.volume || 1)).toFixed(1), t.dur ? t.dur.toFixed(2) : ''].join(','));
  fs.mkdirSync(path.dirname(path.resolve(opts.cues)), { recursive: true });
  fs.writeFileSync(path.resolve(opts.cues), 'arranca_s,golpe_s,sonido,ganancia_db,duracion_s\n' + rows.join('\n') + '\n');
}
const tmp = path.join(os.tmpdir(), `mix-${process.pid}.json`);
fs.writeFileSync(tmp, JSON.stringify({ duration: ev.duration, tracks }));
fs.mkdirSync(path.dirname(path.resolve(opts.wav)), { recursive: true });
const py = spawnSync('python3', ['-I', path.join(ROOT, 'scripts', 'mixdown.py'), tmp, path.resolve(opts.wav), ...(opts.bus ? ['--bus', opts.bus] : []), ...(space !== undefined && space !== 'off' ? ['--space', String(space)] : [])], { encoding: 'utf8' });
fs.rmSync(tmp, { force: true });
if (py.status !== 0) { console.error(py.stderr); process.exit(1); }
console.log(`♪ ${path.relative(process.cwd(), path.resolve(opts.wav))}  ${py.stdout.trim()}`);

if (opts.video && opts.mux) {
  fs.mkdirSync(path.dirname(path.resolve(opts.mux)), { recursive: true });
  const ff = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', path.resolve(opts.video), '-i', path.resolve(opts.wav),
    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-shortest',
    '-movflags', '+faststart', path.resolve(opts.mux)], { encoding: 'utf8' });
  if (ff.status !== 0) { console.error(ff.stderr); process.exit(1); }
  console.log(`▶ ${path.relative(process.cwd(), path.resolve(opts.mux))}`);
}
