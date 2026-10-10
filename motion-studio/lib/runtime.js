/*
 * motion-studio runtime (classic script — load after gsap).
 *
 * Contract: one paused master timeline drives the whole composition. The
 * renderer (scripts/render.mjs) calls window.__motion.seek(t) for every
 * (sub)frame, so preview and final render go through the exact same code path.
 *
 * Rules that keep renders deterministic:
 *  - Every tween lives inside the master `tl` (never a free-standing gsap.to()).
 *  - No Math.random(): use the seeded `random` helper passed to build().
 *  - No setTimeout/setInterval/Date for animation timing.
 *  - CSS @keyframes animations are allowed: they are paused and scrubbed too.
 *  - <video data-sync data-offset="1.5"> elements are seeked frame-accurately.
 */
(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  const RENDER = params.has('render');

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seekVideo(video, time) {
    return new Promise((resolve) => {
      const target = Math.max(0, Math.min(time, (video.duration || Infinity) - 0.001));
      if (Math.abs(video.currentTime - target) < 0.0005) return resolve();
      const done = () => { video.removeEventListener('seeked', done); resolve(); };
      video.addEventListener('seeked', done);
      video.currentTime = target;
    });
  }

  function create(config, build) {
    const cfg = Object.assign(
      { width: 1080, height: 1920, fps: 30, duration: null, seed: 1, background: '#000' },
      config
    );

    let stage = document.getElementById('stage');
    if (!stage) {
      stage = document.createElement('div');
      stage.id = 'stage';
      document.body.appendChild(stage);
    }
    Object.assign(stage.style, {
      width: cfg.width + 'px',
      height: cfg.height + 'px',
      position: 'relative',
      overflow: 'hidden',
      background: cfg.background,
    });
    document.documentElement.classList.add(RENDER ? 'is-render' : 'is-preview');

    const defaultEase = window.CustomEase && window.MotionPresets ? 'glide' : 'power3.out';
    const tl = gsap.timeline({ paused: true, defaults: { duration: 0.8, ease: defaultEase } });
    const random = mulberry32(cfg.seed);
    let currentTime = 0;

    async function seek(t) {
      const total = cfg.duration ?? tl.duration();
      currentTime = Math.max(0, Math.min(t, total));
      tl.time(Math.min(currentTime, tl.duration()), false);
      for (const anim of document.getAnimations()) {
        anim.pause();
        anim.currentTime = currentTime * 1000;
      }
      const videos = document.querySelectorAll('video[data-sync]');
      if (videos.length) {
        await Promise.all([...videos].map((v) => seekVideo(v, currentTime - parseFloat(v.dataset.offset || 0))));
      }
    }

    const ready = (async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
      for (const v of document.querySelectorAll('video[data-sync]')) {
        v.muted = true;
        v.pause();
        if (v.readyState < 1) await new Promise((r) => v.addEventListener('loadedmetadata', r, { once: true }));
      }
      await build(tl, { stage, cfg, random, P: window.MotionPresets });
      if (cfg.duration == null) cfg.duration = tl.duration();
      await seek(0);
      if (!RENDER) mountPreview();
      return true;
    })();

    window.__motion = {
      get width() { return cfg.width; },
      get height() { return cfg.height; },
      get fps() { return cfg.fps; },
      get duration() { return cfg.duration ?? tl.duration(); },
      get background() { return cfg.background; },
      get post() { return cfg.post || {}; },
      seek,
      ready,
      tl,
    };

    // ---------------------------------------------------------------- preview
    function mountPreview() {
      const css = document.createElement('style');
      css.textContent = `
        html.is-preview, html.is-preview body { margin:0; height:100%; background:#0d0d0f; overflow:hidden; }
        #ms-wrap { position:fixed; inset:0 0 56px 0; display:flex; align-items:center; justify-content:center; }
        #ms-scaler { transform-origin: center center; box-shadow: 0 30px 80px rgba(0,0,0,.6); }
        #ms-bar { position:fixed; left:0; right:0; bottom:0; height:56px; display:flex; gap:12px; align-items:center;
          padding:0 16px; background:#16161a; color:#ddd; font:12px/1 ui-monospace, Menlo, monospace; z-index:99; }
        #ms-bar button { background:#26262c; color:#eee; border:0; border-radius:6px; padding:8px 10px; cursor:pointer; font:inherit; }
        #ms-bar button.on { background:#C8F135; color:#111; }
        #ms-range { flex:1; accent-color:#C8F135; }
        .ms-overlay { position:absolute; inset:0; pointer-events:none; z-index:98; display:none; }
        .ms-overlay.on { display:block; }
      `;
      document.head.appendChild(css);

      const wrap = document.createElement('div');
      wrap.id = 'ms-wrap';
      const scaler = document.createElement('div');
      scaler.id = 'ms-scaler';
      stage.parentNode.insertBefore(wrap, stage);
      wrap.appendChild(scaler);
      scaler.appendChild(stage);

      // Reels/TikTok UI safe zones (approximate, conservative) + rule of thirds.
      const safe = document.createElement('div');
      safe.className = 'ms-overlay';
      const W = cfg.width, H = cfg.height;
      const top = Math.round(H * 0.13), bottom = Math.round(H * 0.23), left = Math.round(W * 0.055), right = Math.round(W * 0.13);
      safe.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
          <path fill="rgba(255,0,80,.28)" fill-rule="evenodd"
            d="M0 0H${W}V${H}H0Z M${left} ${top}H${W - right}V${H - bottom}H${left}Z"/>
          <rect x="${left}" y="${top}" width="${W - left - right}" height="${H - top - bottom}" fill="none" stroke="#ff0050" stroke-width="3" stroke-dasharray="14 10"/>
          <text x="${left + 12}" y="${top + 34}" fill="#ff0050" font-size="26" font-family="monospace">SAFE ZONE</text>
        </svg>`;
      const grid = document.createElement('div');
      grid.className = 'ms-overlay';
      grid.innerHTML = `<svg width="${W}" height="${H}"><g stroke="rgba(200,241,53,.55)" stroke-width="2">
          <line x1="${W / 3}" y1="0" x2="${W / 3}" y2="${H}"/><line x1="${(2 * W) / 3}" y1="0" x2="${(2 * W) / 3}" y2="${H}"/>
          <line x1="0" y1="${H / 3}" x2="${W}" y2="${H / 3}"/><line x1="0" y1="${(2 * H) / 3}" x2="${W}" y2="${(2 * H) / 3}"/>
          <line x1="${W / 2}" y1="0" x2="${W / 2}" y2="${H}" stroke-dasharray="8 8"/></g></svg>`;
      stage.appendChild(safe);
      stage.appendChild(grid);

      const bar = document.createElement('div');
      bar.id = 'ms-bar';
      bar.innerHTML = `
        <button id="ms-play">▶ Play</button>
        <input id="ms-range" type="range" min="0" max="1" step="0.0001" value="0">
        <span id="ms-time">0.00s · f0</span>
        <button id="ms-loop" class="on">Loop</button>
        <button id="ms-safe">Safe (S)</button>
        <button id="ms-grid">Grid (G)</button>`;
      document.body.appendChild(bar);

      const $ = (id) => document.getElementById(id);
      const total = () => cfg.duration ?? tl.duration();
      let playing = false, loop = true, t0 = 0, startT = 0;

      function fit() {
        const s = Math.min(wrap.clientWidth / cfg.width, wrap.clientHeight / cfg.height) * 0.94;
        scaler.style.transform = `scale(${s})`;
        scaler.style.width = cfg.width + 'px';
        scaler.style.height = cfg.height + 'px';
      }
      function label() {
        $('ms-range').value = currentTime / total();
        $('ms-time').textContent = `${currentTime.toFixed(2)}s · f${Math.round(currentTime * cfg.fps)} / ${total().toFixed(2)}s`;
      }
      function frame(now) {
        if (!playing) return;
        let t = startT + (now - t0) / 1000;
        if (t >= total()) {
          if (loop) { startT = 0; t0 = now; t = 0; } else { t = total(); playing = false; $('ms-play').textContent = '▶ Play'; }
        }
        seek(t).then(label);
        requestAnimationFrame(frame);
      }
      function toggle() {
        playing = !playing;
        $('ms-play').textContent = playing ? '❚❚ Pause' : '▶ Play';
        if (playing) {
          if (currentTime >= total()) currentTime = 0;
          startT = currentTime; t0 = performance.now();
          requestAnimationFrame(frame);
        }
      }
      function step(frames) {
        playing = false; $('ms-play').textContent = '▶ Play';
        seek(currentTime + frames / cfg.fps).then(label);
      }

      $('ms-play').onclick = toggle;
      $('ms-range').oninput = (e) => { playing = false; $('ms-play').textContent = '▶ Play'; seek(e.target.value * total()).then(label); };
      $('ms-loop').onclick = (e) => { loop = !loop; e.target.classList.toggle('on', loop); };
      $('ms-safe').onclick = (e) => { safe.classList.toggle('on'); e.target.classList.toggle('on'); };
      $('ms-grid').onclick = (e) => { grid.classList.toggle('on'); e.target.classList.toggle('on'); };
      window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') { e.preventDefault(); toggle(); }
        if (e.code === 'ArrowRight') step(e.shiftKey ? 10 : 1);
        if (e.code === 'ArrowLeft') step(e.shiftKey ? -10 : -1);
        if (e.code === 'KeyS') $('ms-safe').click();
        if (e.code === 'KeyG') $('ms-grid').click();
        if (e.code === 'Home') { playing = false; seek(0).then(label); }
      });
      window.addEventListener('resize', fit);
      fit();
      label();
      if (params.has('t')) seek(parseFloat(params.get('t'))).then(label);
    }

    return window.__motion;
  }

  window.MotionComp = { create, mulberry32, RENDER };
})();
