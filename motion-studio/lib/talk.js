/*
 * Split-screen talking-head editor.
 *
 * Reads ./plan.json, ./words.json and ./meta.json (written by scripts/prep.py) and builds the whole
 * edit on the master timeline: layouts, speaker framing, captions, B-roll templates, overlays,
 * transitions and sound design. The plan is the only thing you edit per video.
 *
 * plan.segments[]: { start, end, layout, broll?, overlay?, transition?, zoom?, captions?, title?, image? }
 *   layout:     split (B-roll top / speaker bottom) · speaker (full) · broll (full) · hook (opener card)
 *   broll:      { type: image|clip|icon|title|list|stat|flow|browser|terminal, bg: dark|light|brand|accent, ... }
 *   overlay:    { text: 'y lo|mejor', style: serif|bold|outline, at? }   ('|' = line break)
 *   transition: cut (default) · zoom · leak · whip · flash
 */
(async function () {
  'use strict';

  const W = 1080, H = 1920;
  const get = (f) => fetch(new URL(f, location.href), { cache: 'no-store' }).then((r) => r.json());
  const [plan, data, meta] = await Promise.all([get('plan.json'), get('words.json'), get('meta.json')]);
  const words = data.words;
  const theme = plan.theme || {};
  const SPLIT = Math.round(H * (plan.split ?? 0.55));
  const RECT = {
    top: { x: 0, y: 0, w: W, h: SPLIT },
    bottom: { x: 0, y: SPLIT, w: W, h: H - SPLIT },
    full: { x: 0, y: 0, w: W, h: H },
    card: { x: 90, y: 1010, w: 900, h: 780 },
  };
  const CAP_Y = { split: SPLIT - 22, speaker: Math.round(H * 0.7), broll: Math.round(H * 0.67) };
  const OVL_Y = { speaker: Math.round(H * 0.68), split: Math.round(SPLIT * 0.72), broll: Math.round(H * 0.5) };

  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clean = (w) => w.toLowerCase().replace(/[^\p{L}\p{N}$%€]/gu, '');
  const el = (tag, cls, html, parent) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  };
  const place = (node, r) => Object.assign(node.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });

  // ---------------------------------------------------------------- segments
  const segs = plan.segments.map((s, i, arr) => ({
    ...s, i, start: s.start, end: s.end ?? (arr[i + 1] ? arr[i + 1].start : meta.duration),
  }));
  const segAt = (t) => segs.find((s) => t >= s.start && t < s.end) || segs[segs.length - 1];
  const hlSet = new Set(plan.highlights || []);
  const hlWords = new Set((plan.highlightWords || []).map(clean));
  words.forEach((w, i) => { if (hlWords.has(clean(w.w))) hlSet.add(i); });

  // ---------------------------------------------------------------- fonts first (SplitText measures text)
  await Promise.all([
    `800 60px ${theme.sans || 'Montserrat'}`, `900 60px ${theme.sans || 'Montserrat'}`, `700 60px ${theme.sans || 'Montserrat'}`,
    `600 60px ${theme.sans || 'Montserrat'}`, `italic 400 60px "${theme.serif || 'Instrument Serif'}"`, '600 20px Inter',
  ].map((f) => document.fonts.load(f).catch(() => {})));

  // ---------------------------------------------------------------- DOM
  const stage = document.getElementById('stage');
  for (const [k, v] of Object.entries({ accent: theme.accent, accent2: theme.accent2, ink: theme.ink, brand: theme.brand, light: theme.light, dark: theme.dark })) {
    if (v) stage.style.setProperty('--' + k, v);
  }
  if (theme.sans) stage.style.setProperty('--sans', theme.sans);
  if (theme.serif) stage.style.setProperty('--serif', `'${theme.serif}'`);

  const world = el('div', '', null, stage); world.id = 'world';
  const bg = el('div', 'layer', null, world); bg.id = 'bg';
  const brollLayer = el('div', 'layer', null, world); brollLayer.id = 'broll';
  const spkBox = el('div', '', null, world); spkBox.id = 'spk-box';
  const spkDrift = el('div', '', null, spkBox); spkDrift.id = 'spk-drift';
  const spkImg = el('img', '', null, spkDrift); spkImg.id = 'spk-img';
  const hook = el('div', 'layer', null, world); hook.id = 'hook';
  const ovlLayer = el('div', 'layer', null, world);
  const capLayer = el('div', 'layer', null, stage);
  const flash = el('div', '', null, stage); flash.id = 'fx-flash';
  const leak = el('div', '', null, stage); leak.id = 'fx-leak';

  // ---------------------------------------------------------------- speaker framing (face-aware cover crop)
  const face = meta.face || { x: 0.5, y: 0.4 };
  function frameSpeaker(r, zoom, faceY) {
    const s = Math.max(r.w / meta.width, r.h / meta.height) * zoom;
    const w = meta.width * s, h = meta.height * s;
    const x = Math.min(0, Math.max(r.w - w, r.w / 2 - face.x * w));
    const y = Math.min(0, Math.max(r.h - h, r.h * faceY - face.y * h));
    return { left: x, top: y, width: w, height: h };
  }
  const SPK = {
    split: (s) => ({ r: RECT.bottom, radius: 0, faceY: 0.42, zoom: s.zoom ?? 1 }),
    speaker: (s) => ({ r: RECT.full, radius: 0, faceY: 0.36, zoom: s.zoom ?? 1 }),
    hook: (s) => ({ r: RECT.card, radius: 46, faceY: 0.45, zoom: s.zoom ?? 1 }),
  };

  // ---------------------------------------------------------------- frame-sequence hooks
  const spkVisible = (t) => segAt(t).layout !== 'broll';
  let spkIdx = -1;
  const framePath = (dir, i) => `${dir}/${String(i).padStart(5, '0')}.jpg`;
  const loadFrame = async (img, src) => { img.src = src; try { await img.decode(); } catch (e) { /* missing frame */ } };
  const clipHooks = [];
  MotionComp.onSeek(async (t) => {
    const jobs = [];
    if (spkVisible(t)) {
      const i = Math.max(0, Math.min(meta.frames - 1, Math.floor(t * meta.fps + 1e-6)));
      if (i !== spkIdx) { spkIdx = i; jobs.push(loadFrame(spkImg, framePath('media/frames', i))); }
    }
    for (const h of clipHooks) jobs.push(h(t));
    await Promise.all(jobs);
  });

  // ---------------------------------------------------------------- sound design
  const audio = [{ src: 'media/voice.wav', at: 0, volume: plan.voiceVolume ?? 1 }];
  if (plan.music) audio.push({ src: plan.music, at: 0, volume: plan.musicVolume ?? 0.12, loop: true });
  const sfx = (name, at, volume = 0.5) => { if (plan.sfx !== false) audio.push({ src: `/assets/sfx/${name}.wav`, at: Math.max(0, at), volume }); };
  const boost = [];

  // Shrink a wrapping text block until no line (or long single word) overflows its container.
  function fitBlock(node, maxH, min = 28) {
    let size = parseFloat(getComputedStyle(node).fontSize);
    while ((node.scrollWidth > node.clientWidth + 1 || node.offsetHeight > maxH) && size > min) {
      size *= 0.93;
      node.style.fontSize = size + 'px';
    }
  }

  // ---------------------------------------------------------------- B-roll templates
  const T = {};

  T.title = (b, node, tl, s, P) => {
    const c = el('div', 'center', `<h2 class="t-title ${b.style === 'serif' ? 'serif' : ''}">${esc(b.text)}</h2>` +
      (b.sub ? `<div class="t-sub">${esc(b.sub)}</div>` : ''), node);
    const h2 = c.querySelector('h2');
    fitBlock(h2, node.clientHeight * 0.75);
    tl.add(b.style === 'serif' ? P.blurIn(h2, { by: 'words', stagger: 0.07, blur: 22 }) : P.lineReveal(h2, { stagger: 0.07 }), s.start + 0.02);
    if (b.sub) tl.add(P.blurIn(c.querySelector('.t-sub'), { by: 'words', stagger: 0.04 }), s.start + 0.3);
    tl.fromTo(c, { scale: 1 }, { scale: 1.05, duration: s.end - s.start, ease: 'none', immediateRender: false }, s.start);
  };

  T.image = async (b, node, tl, s) => {
    const img = el('img', 'media' + (b.fit === 'contain' ? ' contain' : ''), null, node);
    img.src = b.src;
    try { await img.decode(); } catch (e) { console.warn('broll image missing', b.src); }
    const d = s.end - s.start;
    const motion = b.motion || 'push';
    if (motion === 'scroll') {
      Object.assign(img.style, { height: 'auto', objectFit: 'fill' });
      const r = node.getBoundingClientRect();
      const travel = Math.max(0, img.naturalHeight * (r.width / img.naturalWidth) - r.height);
      tl.fromTo(img, { y: 0 }, { y: -travel * (b.amount ?? 0.6), duration: d, ease: 'sine.inOut', immediateRender: false }, s.start);
    } else if (motion === 'pan-left' || motion === 'pan-right') {
      const dir = motion === 'pan-left' ? -1 : 1;
      tl.fromTo(img, { scale: 1.15, xPercent: -dir * 5 }, { xPercent: dir * 5, duration: d, ease: 'none', immediateRender: false }, s.start);
    } else if (motion !== 'none') {
      tl.fromTo(img, { scale: 1 }, { scale: b.scale ?? 1.1, duration: d, ease: 'none', immediateRender: false }, s.start);
    }
  };

  T.clip = async (b, node, tl, s) => {
    const info = await get(`${b.src}/info.json`);
    const img = el('img', 'media' + (b.fit === 'contain' ? ' contain' : ''), null, node);
    let last = -1;
    clipHooks.push(async (t) => {
      if (t < s.start || t >= s.end) return;
      const i = Math.max(0, Math.min(info.frames - 1, Math.floor(((t - s.start) * (b.speed ?? 1) + (b.from ?? 0)) * info.fps + 1e-6)));
      if (i !== last) { last = i; await loadFrame(img, framePath(b.src, i)); }
    });
    if (b.motion !== 'none') tl.fromTo(img, { scale: 1 }, { scale: b.scale ?? 1.06, duration: s.end - s.start, ease: 'none', immediateRender: false }, s.start);
  };

  T.icon = (b, node, tl, s, P) => {
    const wrap = el('div', 't-icons', null, node);
    const items = b.items || [{ glyph: b.glyph, label: b.label, color: b.color, image: b.image }];
    const tiles = items.map((it) => {
      const t = el('div', 't-icon', (it.image ? `<img src="${esc(it.image)}">` : esc(it.glyph ?? (it.label || '?').slice(0, 1))) +
        (it.label && b.labels !== false ? `<span class="lbl">${esc(it.label)}</span>` : ''), wrap);
      t.style.setProperty('--c', it.color || theme.brand || '#631336');
      return t;
    });
    const d = s.end - s.start, per = d / tiles.length;
    tiles.forEach((tile, k) => {
      const t0 = s.start + k * per;
      if (k === 0) tl.fromTo(tile, { scale: 0.55, rotate: -10, autoAlpha: 0 }, { scale: 1, rotate: 0, autoAlpha: 1, duration: 0.5, ease: 'settle', immediateRender: false }, t0 + 0.02);
      else {
        tl.fromTo(tile, { xPercent: 260, rotate: 8, autoAlpha: 1 }, { xPercent: 0, rotate: 0, duration: 0.38, ease: 'snap', immediateRender: false }, t0);
        tl.to(tiles[k - 1], { xPercent: -260, rotate: -8, duration: 0.38, ease: 'snap' }, t0);
        sfx('whoosh-soft', t0 - 0.1, 0.35);
        boost.push([t0, t0 + 0.38]);
      }
      tl.fromTo(tile, { y: 0 }, { y: -18, duration: per, ease: 'sine.inOut', immediateRender: false }, t0);
    });
    tl.set(tiles.slice(1), { autoAlpha: 0 }, s.start);
  };

  T.list = (b, node, tl, s, P) => {
    const c = el('div', 'center', null, node);
    const box = el('div', 't-list', (b.title ? `<h3>${esc(b.title)}</h3>` : ''), c);
    const items = (b.items || []).map((it) => {
      const o = typeof it === 'string' ? { text: it, ok: true } : it;
      return el('div', 't-item' + (o.ok === false ? ' no' : ''), `<span class="mk">${o.ok === false ? '✕' : '✓'}</span><span>${esc(o.text)}</span>`, box);
    });
    const d = s.end - s.start, step = Math.min(0.45, (d * 0.7) / Math.max(1, items.length));
    if (b.title) tl.add(P.lineReveal(box.querySelector('h3')), s.start + 0.02);
    items.forEach((it, k) => {
      const t0 = s.start + 0.18 + k * step;
      tl.fromTo(it, { x: -60, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.35, ease: 'glide', immediateRender: false }, t0);
      tl.fromTo(it.querySelector('.mk'), { scale: 0 }, { scale: 1, duration: 0.35, ease: 'back.out(2.5)', immediateRender: false }, t0 + 0.08);
      sfx('tick', t0 + 0.08, 0.45);
    });
  };

  T.stat = (b, node, tl, s, P) => {
    const c = el('div', 'center', `<div class="t-stat"></div>${b.label ? `<div class="t-stat-lbl">${esc(b.label)}</div>` : ''}`, node);
    const num = c.querySelector('.t-stat');
    const d = Math.min(1.3, (s.end - s.start) * 0.6);
    tl.add(P.countUp(num, { from: b.from ?? 0, to: b.value ?? 100, prefix: b.prefix ?? '', suffix: b.suffix ?? '', decimals: b.decimals ?? 0, duration: d, ease: 'snap' }), s.start + 0.05);
    tl.fromTo(num, { scale: 0.85 }, { scale: 1, duration: d, ease: 'glide', immediateRender: false }, s.start + 0.05);
    if (b.label) tl.add(P.blurIn(c.querySelector('.t-stat-lbl'), { by: 'words', stagger: 0.05 }), s.start + 0.25);
  };

  T.flow = (b, node, tl, s, P) => {
    const wrap = el('div', 't-flow', null, node);
    const kids = b.nodes || [];
    const rootY = 24, kidY = 70;
    const xs = kids.map((_, k) => (kids.length === 1 ? 50 : 20 + (60 * k) / (kids.length - 1)));
    const pw = node.clientWidth, ph = node.clientHeight, X = (p) => (p * pw) / 100, Y = (p) => (p * ph) / 100;
    const y0 = Y(rootY) + 0.06 * ph, y1 = Y(kidY) - 0.06 * ph, ym = (y0 + y1) / 2;
    wrap.innerHTML = `<svg viewBox="0 0 ${pw} ${ph}">${xs.map((x) =>
      `<path style="stroke-width:4px" d="M${X(50)},${y0} C${X(50)},${ym} ${X(x)},${ym - 0.04 * ph} ${X(x)},${y1}"/>`).join('')}</svg>`;
    const root = el('div', 't-node root', `<div class="box">${esc(b.root)}</div>`, wrap);
    Object.assign(root.style, { left: '50%', top: rootY + '%' });
    const nodes = kids.map((k, i) => {
      const n = el('div', 't-node', `<div class="box">${esc(typeof k === 'string' ? k : k.label)}</div>` + (b.tag ? `<div class="tag">${esc(b.tag)}</div>` : ''), wrap);
      Object.assign(n.style, { left: xs[i] + '%', top: kidY + '%' });
      return n;
    });
    tl.fromTo(root, { scale: 0.5, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.45, ease: 'settle', immediateRender: false }, s.start + 0.02);
    tl.add(P.draw(wrap.querySelectorAll('path'), { duration: 0.55, stagger: 0.08 }), s.start + 0.3);
    nodes.forEach((n, i) => {
      tl.fromTo(n, { scale: 0.5, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.4, ease: 'settle', immediateRender: false }, s.start + 0.65 + i * 0.12);
      sfx('pop', s.start + 0.65 + i * 0.12, 0.3);
    });
  };

  T.browser = async (b, node, tl, s, P) => {
    const win = el('div', 't-win', `<div class="bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span><div class="url">${esc(b.url || '')}</div></div><div class="body"></div>`, node);
    const body = win.querySelector('.body');
    const d = s.end - s.start;
    if (b.image) {
      const img = el('img', '', null, body);
      img.src = b.image;
      try { await img.decode(); } catch (e) { /* missing */ }
      tl.fromTo(img, { yPercent: 0 }, { yPercent: -(b.scroll ?? 8), duration: d, ease: 'sine.inOut', immediateRender: false }, s.start);
    } else {
      body.innerHTML = `<h4>${esc(b.title || '')}</h4>` + Array.from({ length: b.lines ?? 4 }, (_, k) => `<div class="ln" style="width:${[92, 78, 85, 60, 70][k % 5]}%"></div>`).join('') +
        (b.button ? `<span class="btn">${esc(b.button)}</span>` : '');
      if (b.title) tl.add(P.lineReveal(body.querySelector('h4')), s.start + 0.25);
      tl.fromTo(body.querySelectorAll('.ln'), { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: 'glide', stagger: 0.07, immediateRender: false }, s.start + 0.35);
      if (b.button) tl.add(P.popIn(body.querySelector('.btn'), { rotate: 0, ease: 'settle' }), s.start + 0.7);
    }
    tl.fromTo(win, { y: 60, scale: 0.94, autoAlpha: 0 }, { y: 0, scale: 1, autoAlpha: 1, duration: 0.5, ease: 'glide', immediateRender: false }, s.start + 0.02);
    if (b.url) tl.add(P.typewriter(win.querySelector('.url'), { cps: 40, caret: '', hold: 0 }), s.start + 0.15);
  };

  T.terminal = (b, node, tl, s) => {
    const term = el('div', 't-term', null, node);
    const lines = (b.lines || []).map((l) => {
      const div = el('div', '', null, term);
      const prompt = l.startsWith('$ ');
      const cls = /^[✓✔]/.test(l) ? 'ok' : /^[⚠✕✗!]/.test(l) ? 'warn' : '';
      div.innerHTML = (prompt ? '<span class="p">$ </span>' : '') + `<span class="${cls}">${esc(prompt ? l.slice(2) : l)}</span>`;
      return div;
    });
    tl.fromTo(term, { y: 50, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.45, ease: 'glide', immediateRender: false }, s.start + 0.02);
    let t = s.start + 0.25;
    const chars = (b.lines || []).join('').length;
    const cps = b.cps ?? Math.max(38, chars / Math.max(0.4, (s.end - s.start) * 0.55));
    lines.forEach((div) => {
      const sp = MotionPresets.split(div.lastElementChild, 'chars');
      tl.set(sp.chars, { opacity: 0 }, s.start);
      sp.chars.forEach((ch, k) => tl.set(ch, { opacity: 1 }, t + k / cps));
      t += sp.chars.length / cps + 0.12;
    });
  };

  // ---------------------------------------------------------------- build
  const post = { blurBoost: boost, audio, alwaysBoost: true, boostSamples: 10 };

  MotionComp.create({ width: W, height: H, fps: meta.fps, duration: meta.duration, background: theme.dark || '#000', post }, async (tl, { P }) => {
    let speakerCount = 0, prevLayout = null;
    tl.set([spkBox], { autoAlpha: 0 }, 0);

    for (const s of segs) {
      const t = s.start, d = s.end - s.start;
      const layout = s.layout || 'split';

      // background + speaker
      tl.set(bg, { attr: { class: 'layer' + (layout === 'hook' ? ' light' : '') } }, t);
      if (SPK[layout]) {
        if (layout === 'speaker' && s.zoom == null) s.zoom = speakerCount++ % 2 ? 1.14 : 1;   // jump-cut punch-in
        const L = SPK[layout](s);
        tl.set(spkBox, { autoAlpha: 1, left: L.r.x, top: L.r.y, width: L.r.w, height: L.r.h, borderRadius: L.radius, attr: { class: layout === 'hook' ? 'card' : '' } }, t);
        tl.set(spkImg, frameSpeaker(L.r, L.zoom, L.faceY), t);
        if (layout === 'speaker') tl.fromTo(spkDrift, { scale: 1 }, { scale: 1.035, duration: d, ease: 'none', immediateRender: false }, t);
        else tl.set(spkDrift, { scale: 1 }, t);
        if (layout === 'hook') tl.fromTo(spkBox, { y: 80, scale: 0.92 }, { y: 0, scale: 1, duration: 0.6, ease: 'glide', immediateRender: false }, t + 0.1);
        else tl.set(spkBox, { y: 0, scale: 1 }, t);
      } else {
        tl.set(spkBox, { autoAlpha: 0 }, t);
      }

      // B-roll
      if (s.broll && (layout === 'split' || layout === 'broll')) {
        const b = s.broll;
        const node = el('div', `broll ${b.bg || (b.type === 'icon' ? 'light' : 'dark')}`, null, brollLayer);
        place(node, layout === 'split' ? RECT.top : RECT.full);
        const make = T[b.type] || T.title;
        await make(b, node, tl, s, P);
        tl.set(node, { autoAlpha: 1 }, t).set(node, { autoAlpha: 0 }, s.end);
      }

      // hook opener
      if (layout === 'hook') {
        hook.innerHTML = '';
        const title = el('div', 'h-title', esc(s.title || ''), hook);
        fitBlock(title, 480);
        const hw = words.filter((w) => w.s >= t && w.s < s.end);
        const titleN = s.titleWords ?? (s.title || '').split(/\s+/).filter(Boolean).length;
        const subWords = s.sub === false ? [] : hw.slice(titleN);
        const sub = el('div', 'h-sub', subWords.map((w) => `<span class="w">${esc(w.w)}</span>`).join(' '), hook);
        sub.style.top = title.offsetTop + title.offsetHeight + 26 + 'px';
        if (s.image) {
          const img = el('img', 'h-img', null, hook);
          img.src = s.image;
          try { await img.decode(); } catch (e) { /* missing */ }
          img.style.top = sub.offsetTop + sub.offsetHeight + 30 + 'px';
          tl.fromTo(img, { scale: 0.7, autoAlpha: 0, rotate: -6 }, { scale: 1, autoAlpha: 1, rotate: 0, duration: 0.6, ease: 'settle', immediateRender: false }, t + 0.25);
        }
        tl.set(hook, { autoAlpha: 1 }, t).set(hook, { autoAlpha: 0 }, s.end);
        tl.fromTo(title, { scale: 1.25, filter: 'blur(18px)', autoAlpha: 0 }, { scale: 1, filter: 'blur(0px)', autoAlpha: 1, duration: 0.45, ease: 'glide', immediateRender: false }, t);
        // words join the line as they are spoken (display toggles so each line re-centres, like the reference)
        sub.querySelectorAll('.w').forEach((sp, k) => {
          const at = Math.max(t, subWords[k].s - 0.04);
          tl.set(sp, { display: 'inline-block' }, at)
            .fromTo(sp, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.16, ease: 'glide', immediateRender: false }, at);
        });
        sfx('impact', t, 0.35);
      }

      // overlay (emphasis words)
      if (s.overlay && layout !== 'hook') {
        const o = s.overlay;
        const ov = el('div', 'ovl ' + (o.style || 'serif'), String(o.text).split('|').map((l) => `<span class="l">${esc(l)}</span>`).join(''), ovlLayer);
        if (o.color) ov.style.color = o.color;
        ov.style.top = (o.y != null ? o.y * H : OVL_Y[layout]) + 'px';
        gsap.set(ov, { yPercent: -50 });
        const at = o.at ?? t + 0.05;
        s.ovlAt = at;
        tl.set(ov, { autoAlpha: 1 }, at).set(ov, { autoAlpha: 0 }, s.end);
        tl.add(o.style === 'bold' ? P.wordPop(ov, { stagger: 0.08 }) : P.blurIn(ov, { by: 'words', stagger: 0.09, blur: 24, scale: 1.25 }), at);
        sfx('pop', at, 0.45);
      }

      // transitions + layout-change whooshes
      if (s.i > 0) {
        const tr = s.transition || 'cut';
        if (tr === 'zoom') {
          tl.to(world, { scale: 1.2, filter: 'blur(14px)', duration: 0.12, ease: 'power2.in' }, t - 0.12)
            .fromTo(world, { scale: 1.2, filter: 'blur(14px)' }, { scale: 1, filter: 'blur(0px)', duration: 0.22, ease: 'power3.out', immediateRender: false }, t);
          boost.push([t - 0.12, t + 0.22]); sfx('whoosh', t - 0.3, 0.55);
        } else if (tr === 'whip') {
          tl.to(world, { x: -300, duration: 0.12, ease: 'power2.in' }, t - 0.12)
            .fromTo(world, { x: 300 }, { x: 0, duration: 0.22, ease: 'power3.out', immediateRender: false }, t);
          boost.push([t - 0.12, t + 0.22]); sfx('whoosh', t - 0.3, 0.55);
        } else if (tr === 'leak') {
          tl.fromTo(leak, { autoAlpha: 0, xPercent: -12 }, { autoAlpha: 0.95, xPercent: 0, duration: 0.2, ease: 'power1.out', immediateRender: false }, t - 0.2)
            .to(leak, { autoAlpha: 0, xPercent: 12, duration: 0.4, ease: 'power1.in' }, t + 0.02);
          sfx('whoosh-soft', t - 0.25, 0.5);
        } else if (tr === 'flash') {
          tl.add(P.flash(flash, { opacity: 0.85, duration: 0.25 }), t);
          sfx('impact', t, 0.3);
        } else if (prevLayout && prevLayout !== layout && plan.cutWhoosh !== false) {
          sfx('whoosh-soft', t - 0.2, 0.22);
        }
      }
      prevLayout = layout;
    }

    // captions (hidden during the hook and while an overlay is on screen)
    for (const c of data.captions) {
      const s = segAt(c.s + 0.01);
      if (s.layout === 'hook' || s.captions === false || (s.ovlAt != null && c.s >= s.ovlAt - 0.05)) continue;
      const html = c.words.map((i) => `<span class="${hlSet.has(i) ? 'hl' : ''}">${esc(words[i].w)}</span>`).join(' ');
      const cap = el('div', 'cap', html, capLayer);
      cap.style.top = (CAP_Y[s.layout] ?? CAP_Y.split) + 'px';
      gsap.set(cap, { yPercent: -50 });
      const end = Math.min(c.e, s.end + 0.001);
      tl.set(cap, { autoAlpha: 1 }, c.s).set(cap, { autoAlpha: 0 }, end);
      tl.fromTo(cap, { scale: 0.86 }, { scale: 1, duration: 0.14, ease: 'back.out(2.2)', immediateRender: false }, c.s);
    }

    tl.set({}, {}, meta.duration);   // pin the timeline length to the edit length
  });
})();
