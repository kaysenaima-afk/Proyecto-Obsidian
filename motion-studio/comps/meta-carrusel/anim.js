/*
 * FYG × Meta — animated carousel.
 *   ?slide=N  → only slide N (1–9), starts at t=0: one MP4 per carousel card.
 *   (none)    → all slides in sequence with swipe transitions: one continuous video.
 *   Sound design (SFX only — music is chosen by the editor) lives in post.audio; mix it with scripts/mix.mjs.
 *   ?sfx=0 disables the cues.
 * Every slide ends on its static design (the original PDF page) and holds, so a looping card reads cleanly.
 */
(function () {
  'use strict';
  const q = new URLSearchParams(location.search);
  const ONLY = q.has('slide') ? Math.max(1, Math.min(9, parseInt(q.get('slide'), 10))) : null;
  const SFX = q.has('sfx') ? q.get('sfx') !== '0' : true;
  const DUR = [7, 6.5, 7, 7, 7.5, 7, 6.5, 7, 6.5];
  const TR = 0.6;

  // ---------------------------------------------------------------- icons (24×24, stroke)
  const ICONS = {
    sparkle: '<path d="M12 2.5c.6 4.6 2.9 6.9 7.5 7.5-4.6.6-6.9 2.9-7.5 7.5-.6-4.6-2.9-6.9-7.5-7.5 4.6-.6 6.9-2.9 7.5-7.5z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>',
    sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    bell: '<path d="M6.5 16v-5a5.5 5.5 0 0 1 11 0v5l1.5 2h-14z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.2"/><circle cx="12" cy="12" r="1.6"/>',
    square: '<rect x="4.5" y="4.5" width="15" height="13" rx="1.5"/><path d="M8.5 17.5v3.5l3.5-3.5"/>',
    star: '<path d="M12 3.6l2.6 5.2 5.7.8-4.1 4 1 5.7-5.2-2.7-5.1 2.7 1-5.7-4.2-4 5.8-.8z"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path class="shackle" d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    send: '<path d="M21 3 10 14"/><path d="M21 3l-6.5 18-4.5-7-7-4.5z"/>',
    video: '<rect x="3" y="6.5" width="12.5" height="11" rx="2"/><path d="M15.5 10.5 21 7.5v9l-5.5-3"/>',
    msg: '<path d="M4.5 5h15v10.5H9.5l-5 4z"/>',
    calendar: '<rect x="4" y="5.5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3.5v4M15 3.5v4"/>',
    check: '<path class="ckp" d="M5 12.5l4.5 4.5L19 7.5"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/>',
    shield: '<path d="M12 3l7 3v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z"/><path d="M9 12l2.2 2.2L15.2 10"/>',
    file: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h5"/>',
  };
  document.querySelectorAll('[data-ic]').forEach((el) => {
    const fill = el.dataset.fill ? ' fill' : '';
    el.outerHTML = `<svg class="i${fill}" viewBox="0 0 24 24">${ICONS[el.dataset.ic]}</svg>`;
  });

  // ---------------------------------------------------------------- slide 2: six identical ads
  const ADS = [[85, 640, -1.2], [402, 643, 0.8], [718, 640, -0.4], [88, 943, 0.9], [402, 945, -0.5], [718, 944, 0.6]];
  const adsBox = document.querySelector('#s2 .ads');
  ADS.forEach(([x, y, r]) => {
    const a = document.createElement('div');
    a.className = 'ad';
    a.innerHTML = '<div class="av"></div><div class="bar"></div><div class="pub">PUBLICIDAD</div><div class="img">Transformá tu vida<br>hoy</div><div class="cta">Más información</div>';
    Object.assign(a.style, { left: x + 'px', top: y + 'px' });
    a.dataset.r = r;
    adsBox.appendChild(a);
  });

  // ---------------------------------------------------------------- timing
  const slides = [...document.querySelectorAll('.slide')];
  const plan = [];
  if (ONLY) {
    plan.push({ i: ONLY - 1, enter: 0, t0: 0, end: DUR[ONLY - 1] });
  } else {
    let enter = 0;
    DUR.forEach((d, i) => {
      const t0 = i === 0 ? 0 : enter + TR;
      plan.push({ i, enter, t0, end: t0 + d });
      enter = t0 + d - TR;
    });
  }
  const total = plan[plan.length - 1].end;
  // ---------------------------------------------------------------- sound design (assets/sfx/el — scripts/sfxprep.py)
  // Recorded-quality foley (ElevenLabs takes, edited by sfxprep.py). Three rules, as a sound editor would:
  //  • PEAK SYNC: `at` is the frame where the sound lands (the click, the snap, the loudest point of a whoosh);
  //    the file starts earlier by its measured peak offset. Beds (scribble, scramble, shimmer) start at `at`.
  //  • LEVEL BY LOUDNESS: the 3rd argument is the target loudness of the cue (LUFS, momentary). Each file's own
  //    loudness is in the manifest, so variations of one family sound equally loud. Tiers: hero hits -15…-18,
  //    actions (bubbles, toggles, locks, checks, keys) -20…-26, motion (swish) -24…-30, texture -28…-36.
  //  • STEREO FOLLOWS THE SCREEN: `el` pans the cue to where the element sits (±0.45: mono-safe).
  const LIB = window.SFX_EL;
  const BEDS = new Set(['scribble', 'scramble', 'shimmer']);
  // Per-slide trim (dB): brings every card toward -19 LUFS max short-term (measured with scripts/mix.mjs) but never
  // asks the stem limiter for more than ~2 dB, so click-heavy cards stay punchy instead of squashed.
  const TRIM = [1.2, 2.7, 2.4, 0.3, 2.1, 0, 6.3, -0.4, 0.5];
  let trim = 0;
  const turn = {};
  const audio = [];
  const panOf = (el) => {
    const r = el.getBoundingClientRect(), s = el.closest('.slide').getBoundingClientRect();
    return Math.round(Math.max(-0.45, Math.min(0.45, ((r.left + r.width / 2 - s.left) / s.width - 0.5) * 1.1)) * 100) / 100;
  };
  const sfx = (name, at, lufs = -24, o = {}) => {
    if (!SFX) return;
    let file = name;                                                   // 'check-2' = that exact file
    if (!/-\d+$/.test(name)) file = `${name}-${((turn[name] = (turn[name] ?? -1) + 1) % LIB[name]) + 1}`;  // rotate takes
    const fam = file.replace(/-\d+$/, '');
    const { el, ...rest } = o;
    const gain = Math.min(0, lufs - LIB._lufs[file]) + trim;
    const cue = { src: `/assets/sfx/el/${file}.wav`, at: at - (BEDS.has(fam) ? 0 : LIB._peak[file]), land: Math.max(0, at), volume: 10 ** (gain / 20), bus: 'sfx', ...rest };
    if (el) cue.pan = panOf(el);
    if (cue.at < 0) { cue.from = (cue.from || 0) - cue.at; cue.at = 0; }
    audio.push(cue);
  };
  // somebody typing on the other end while the "…" indicator bounces: barely-there key texture
  const chatter = (el, t0, t1) => {
    const gaps = [0.13, 0.09, 0.16, 0.11, 0.14, 0.1];
    for (let t = t0 + 0.06, k = 0; t < t1 - 0.08; t += gaps[k++ % gaps.length]) sfx('key', t, -37 - (k % 3) * 1.5, { el });
  };
  const boost = [];

  MotionComp.create({ width: 1080, height: 1350, fps: 30, duration: total, background: '#F1F4F9', post: { audio, space: -20, blurBoost: boost, alwaysBoost: !ONLY, boostSamples: 10 } }, (tl, { P }) => {
    // ---------- shared moves
    const write = (el, t, d = 1.1, lufs = -28) => {
      tl.fromTo(el, { clipPath: 'inset(-20% 100% -20% 0%)' }, { clipPath: 'inset(-20% 0% -20% 0%)', duration: d, ease: 'power1.inOut', immediateRender: true }, t);
      sfx('scribble', t, lufs, { dur: d + 0.05, el });                      // marker on paper while the note writes
    };
    const rise = (el, t, o = {}) => {
      tl.fromTo(el, { y: o.y ?? 50, autoAlpha: 0, scale: o.scale ?? 0.97 }, { y: 0, autoAlpha: 1, scale: 1, duration: o.d ?? 0.7, ease: o.ease ?? 'glide', immediateRender: true }, t);
      if (o.sound !== false) sfx('swish', t + 0.2, o.lufs ?? -27, { el }); // the air of the card lands as it settles
    };
    const pop = (el, t, o = {}) => {
      tl.fromTo(el, { scale: o.from ?? 0.6, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: o.d ?? 0.4, ease: o.ease ?? 'back.out(2)', immediateRender: true }, t);
      if (o.sound) sfx('pop', t + 0.04, o.lufs ?? -25, { el });
    };
    const keys = (el, t, cps, lufs, every = 1) => {                        // one key per typed character
      [...el.textContent].forEach((ch, i) => { if (ch.trim() && i % every === 0) sfx('key', t + i / cps, lufs - ((i * 7) % 3), { el }); });
    };
    const float = (el, t, d) => tl.fromTo(el, { y: 0 }, { y: -6, duration: d / 2, ease: 'sine.inOut', yoyo: true, repeat: 1, immediateRender: false }, t);
    const bubble = (el, t, me) => {
      tl.fromTo(el, { scale: 0.75, autoAlpha: 0, y: 14 }, { scale: 1, autoAlpha: 1, y: 0, duration: 0.38, ease: 'back.out(1.7)', immediateRender: true }, t);
      sfx(me ? 'send' : 'receive', t + 0.03, me ? -21 : -22, { el });       // pans with the bubble: sent right, received left
    };
    const typing = (el, t0, t1) => {
      tl.fromTo(el, { scale: 0.6, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.25, ease: 'back.out(2)', immediateRender: true }, t0);
      const dots = el.querySelectorAll('i');
      const n = Math.max(1, Math.floor((t1 - t0 - 0.2) / 0.45));
      for (let k = 0; k < n; k++) dots.forEach((d, j) => tl.to(d, { y: -6, duration: 0.15, ease: 'sine.out', yoyo: true, repeat: 1 }, t0 + 0.15 + k * 0.45 + j * 0.1));
      tl.to(el, { autoAlpha: 0, scale: 0.8, duration: 0.12 }, t1 - 0.05);
      chatter(el, t0, t1);
    };
    const heads = (sl, t) => {
      const kk = sl.querySelector('.kk');
      if (kk) { tl.add(P.scramble(kk, { duration: 0.7, chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' }), t + 0.02); sfx('scramble', t + 0.02, -31, { dur: 0.7, el: kk }); }
      const l1 = sl.querySelector('.hl .l1'), l2 = sl.querySelector('.hl .l2');
      if (l1) tl.add(P.lineReveal(l1, { duration: 0.85 }), t + 0.1);
      if (l2) tl.add(P.lineReveal(l2, { duration: 0.85 }), t + 0.24);
      if (l1) sfx('swish', t + 0.36, -25);                                 // one gesture for the headline, landing on line 2
      const bd = sl.querySelector('.bd');
      if (bd) tl.add(P.blurIn(bd, { by: 'words', stagger: 0.016, blur: 10, y: 12, scale: 1, duration: 0.6 }), t + 0.5);
    };
    const lockClose = (lockEl, t) => {
      const sh = lockEl.querySelector('.shackle');
      tl.fromTo(sh, { y: -4 }, { y: 0, duration: 0.22, ease: 'back.out(3)', immediateRender: true }, t);
      tl.fromTo(lockEl, { scale: 1 }, { scale: 1.18, duration: 0.1, yoyo: true, repeat: 1, ease: 'power1.out', immediateRender: false }, t + 0.12);
      sfx('lock', t + 0.09, -24, { el: lockEl });                          // the click when the shackle seats
    };
    const checkDraw = (el, t, file = 'check') => {
      tl.fromTo(el.querySelector('.ckp'), { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.35, ease: 'power2.out', immediateRender: true }, t);
      sfx(file, t + 0.12, -21, { el });                                     // chime as the stroke turns the corner
    };

    // ---------- per-slide choreography (t = moment the slide is fully on screen)
    const BUILD = [
      // 01 cover
      (sl, t) => {
        tl.fromTo(sl.querySelector('.glow'), { xPercent: -20, scale: 0.9 }, { xPercent: 20, scale: 1.1, duration: DUR[0], ease: 'sine.inOut', immediateRender: true }, t);
        tl.add(P.scramble(sl.querySelector('.kk'), { duration: 0.9 }), t + 0.05);
        sfx('scramble', t + 0.05, -32, { dur: 0.9, el: sl.querySelector('.kk') });
        rise(sl.querySelector('.chat1'), t + 0.15, { y: 60, lufs: -29 });
        bubble(sl.querySelector('.b1'), t + 0.6, true);
        typing(sl.querySelector('.t1'), t + 1.05, t + 1.75);
        bubble(sl.querySelector('.b2'), t + 1.75, false);
        bubble(sl.querySelector('.b3'), t + 2.45, true);
        tl.add(P.lineReveal(sl.querySelector('.hero1'), { duration: 0.8 }), t + 0.35);
        tl.fromTo(sl.querySelector('.hero2'), { scale: 0.4, autoAlpha: 0, rotate: -6 }, { scale: 1, autoAlpha: 1, rotate: 0, duration: 0.7, ease: 'settle', immediateRender: true }, t + 0.8);
        sfx('riser-1', t + 0.86, -25);                                         // the swell peaks exactly on the hit…
        sfx('impact-2', t + 0.86, -16);                                        // …boom + crack as "2026" slams in
        tl.add(P.blurIn(sl.querySelector('.hero3'), { by: 'words', stagger: 0.12, blur: 16 }), t + 1.35);
        sfx('swish', t + 1.6, -30);
        write(sl.querySelector('.swipe'), t + 3.0, 0.8, -29);
        tl.to(sl.querySelector('.arr'), { x: 10, duration: 0.35, ease: 'sine.inOut', yoyo: true, repeat: 5 }, t + 3.9);
        float(sl.querySelector('.chat1'), t + 3.1, DUR[0] - 3.2);
      },
      // 02 el problema
      (sl, t) => {
        heads(sl, t);
        const ads = sl.querySelectorAll('.ad');
        ads.forEach((a, k) => {
          gsap.set(a, { rotate: a.dataset.r });
          tl.fromTo(a, { y: 40, scale: 0.9, autoAlpha: 0 }, { y: 0, scale: 1, autoAlpha: 1, duration: 0.42, ease: 'back.out(1.6)', immediateRender: true }, t + 1.15 + k * 0.17);
          sfx('pop', t + 1.2 + k * 0.17, -25 - (k % 2), { el: a });
        });
        // all six flash the same headline at once: same message, nobody stops
        tl.to(sl.querySelectorAll('.ad .img'), { color: '#0864FF', duration: 0.18, ease: 'none', yoyo: true, repeat: 1 }, t + 2.65);
        sfx('buzz', t + 2.66, -23);                                            // "same message": a dull negative cue
        tl.fromTo(sl.querySelectorAll('.ad'), { y: 0 }, { y: -8, duration: 0.18, ease: 'sine.out', yoyo: true, repeat: 1, immediateRender: false }, t + 2.65);
        write(sl.querySelector('.note2'), t + 3.0, 1.4);
      },
      // 03 qué cambió
      (sl, t) => {
        heads(sl, t);
        ['.f1', '.f2', '.f3', '.f4'].forEach((c, k) => {
          const card = sl.querySelector(c);
          rise(card, t + 1.25 + k * 0.16, { y: 40, sound: k === 0 });
          pop(card.querySelector('.tile'), t + 1.45 + k * 0.16, { from: 0.4 });
          pop(card.querySelector('.badge'), t + 1.7 + k * 0.16, { from: 0.5, sound: true, lufs: -25 });
        });
        rise(sl.querySelector('.add3'), t + 2.75, { y: 30, lufs: -30 });
        tl.set(sl.querySelector('.src'), { opacity: 0 }, t).set(sl.querySelector('.src'), { opacity: 1 }, t + 3.1);
        keys(sl.querySelector('.src'), t + 3.1, 60, -35, 4);                   // fast print: a light key texture
        tl.add(P.typewriter(sl.querySelector('.src'), { cps: 60, caret: '', hold: 0 }), t + 3.1);
      },
      // 04 la solución
      (sl, t) => {
        heads(sl, t);
        rise(sl.querySelector('.give'), t + 1.1, { y: 50 });
        ['.r1', '.r2', '.r3'].forEach((r, k) => {
          const row = sl.querySelector(r);
          tl.fromTo(row, { x: -30, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.45, ease: 'glide', immediateRender: true }, t + 1.45 + k * 0.22);
          lockClose(row.querySelector('.lock'), t + 2.3 + k * 0.28);
        });
        sfx('swish', t + 1.6, -30, { el: sl.querySelector('.r1') });
        tl.set(sl.querySelector('.ph'), { opacity: 0 }, t).set(sl.querySelector('.ph'), { opacity: 1 }, t + 3.25);
        keys(sl.querySelector('.ph'), t + 3.25, 32, -29);
        tl.add(P.typewriter(sl.querySelector('.ph'), { cps: 32, caret: '', hold: 0 }), t + 3.25);
        tl.fromTo(sl.querySelector('.inp .send'), { scale: 1 }, { scale: 1.15, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out', immediateRender: false }, t + 4.7);
        sfx('click', t + 4.72, -24, { el: sl.querySelector('.inp .send') });
        rise(sl.querySelector('.add4'), t + 4.4, { y: 30, lufs: -30 });
      },
      // 05 cómo se ve
      (sl, t) => {
        heads(sl, t);
        const steps = sl.querySelectorAll('.st'), dashes = sl.querySelectorAll('.dash');
        rise(sl.querySelector('.chat5'), t + 0.85, { y: 50 });
        const at = [1.0, 1.75, 2.5, 3.25];
        steps.forEach((s, k) => {
          pop(s.querySelector('.step-tile'), t + at[k], { from: 0.5, sound: true, lufs: -25 });
          tl.fromTo([...s.children].slice(1), { x: -20, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.45, ease: 'glide', stagger: 0.06, immediateRender: true }, t + at[k] + 0.1);
          if (dashes[k]) tl.fromTo(dashes[k], { scaleY: 0 }, { scaleY: 1, duration: 0.5, ease: 'power1.inOut', immediateRender: true }, t + at[k] + 0.25);
        });
        checkDraw(steps[3].querySelector('.step-tile'), t + at[3] + 0.15, 'check-1');
        bubble(sl.querySelector('.m1'), t + 1.25, true);
        typing(sl.querySelector('.t2'), t + 1.7, t + 2.25);
        bubble(sl.querySelector('.m2'), t + 2.25, false);
        bubble(sl.querySelector('.m3'), t + 2.95, true);
        typing(sl.querySelector('.t3'), t + 3.35, t + 3.9);
        bubble(sl.querySelector('.m4'), t + 3.9, false);
        tl.fromTo(sl.querySelector('.ex5'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, immediateRender: true }, t + 4.4);
      },
      // 06 la regla
      (sl, t) => {
        heads(sl, t);
        rise(sl.querySelector('.yes'), t + 0.8, { y: 50 });
        rise(sl.querySelector('.never'), t + 0.95, { y: 50, sound: false });
        ['.tg1', '.tg2', '.tg3', '.tg4'].forEach((g, k) => {
          const tg = sl.querySelector(g), at = t + 1.6 + k * 0.32;
          tl.fromTo(tg, { backgroundColor: '#CBD3DE' }, { backgroundColor: '#0A65FE', duration: 0.25, ease: 'none', immediateRender: false }, at);
          tl.fromTo(tg.querySelector('.knob'), { x: 0 }, { x: 28, duration: 0.3, ease: 'snap', immediateRender: false }, at);
          sfx('toggle', at + 0.07, -23, { el: tg });                           // the knob seats at the end of its travel
        });
        ['.n1', '.n2', '.n3', '.n4'].forEach((n, k) => {
          const row = sl.querySelector(n), at = t + 2.0 + k * 0.32;
          tl.fromTo(row, { x: 24, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.4, ease: 'glide', immediateRender: true }, at - 0.25);
          lockClose(row.querySelector('.lock'), at + 0.15);
        });
        rise(sl.querySelector('.add6'), t + 3.6, { y: 30, lufs: -30 });
        write(sl.querySelector('.note6'), t + 4.1, 1.1);
      },
      // 07 el proceso
      (sl, t) => {
        heads(sl, t);
        ['.p1', '.p2', '.p3'].forEach((p, k) => {
          const card = sl.querySelector(p), at = t + 1.2 + k * 0.3;
          tl.fromTo(card, { x: 140, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.6, ease: 'glide', immediateRender: true }, at);
          tl.add(P.scramble(card.querySelector('.num'), { duration: 0.5, chars: '0123456789', revealDelay: 0.2 }), at + 0.1);
          pop(card.querySelector('.tile'), at + 0.3, { from: 0.4, sound: true, lufs: -29 });
          sfx('swish', at + 0.18, -26, { el: card });                           // each card's air as it slides in
        });
        write(sl.querySelector('.note7'), t + 3.0, 1.1);
      },
      // 08 qué ganás
      (sl, t) => {
        heads(sl, t);
        rise(sl.querySelector('.rep'), t + 1.1, { y: 50 });
        pop(sl.querySelector('.auto'), t + 1.5, { from: 0.5, sound: true, lufs: -25 });
        ['.q1', '.q2', '.q3'].forEach((r, k) => {
          const row = sl.querySelector(r), at = t + 1.6 + k * 0.38;
          tl.fromTo(row, { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.4, ease: 'glide', immediateRender: true }, at);
          checkDraw(row.querySelector('.ck'), at + 0.35, `check-${k + 1}`);    // each check a step higher: a rising run
        });
        tl.fromTo(sl.querySelector('.add8'), { y: 120, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.65, ease: 'back.out(1.4)', immediateRender: true }, t + 3.35);
        sfx('swish', t + 3.5, -29, { el: sl.querySelector('.add8') });
        sfx('notify', t + 3.52, -17, { el: sl.querySelector('.add8') });       // the calendar notification lands
        tl.fromTo(sl.querySelector('.ex8'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, immediateRender: true }, t + 3.9);
      },
      // 09 CTA
      (sl, t) => {
        tl.fromTo(sl.querySelector('.glow'), { scale: 0.85 }, { scale: 1.15, duration: DUR[8], ease: 'sine.inOut', immediateRender: true }, t);
        tl.add(P.lineReveal(sl.querySelector('.cta1'), { duration: 0.85 }), t + 0.15);
        sfx('swish', t + 0.4, -24);
        tl.add(P.blurIn(sl.querySelector('.cta2'), { by: 'chars', stagger: 0.04, blur: 18 }), t + 0.5);
        sfx('swish', t + 0.8, -29);
        tl.add(P.blurIn(sl.querySelector('.cta3'), { by: 'words', stagger: 0.022, blur: 10, y: 12, scale: 1 }), t + 0.95);
        rise(sl.querySelector('.cbox'), t + 1.6, { y: 40 });
        const typed = P.split(sl.querySelector('.typed'), 'chars');
        tl.set(typed.chars, { opacity: 0 }, t);
        typed.chars.forEach((c, k) => { tl.set(c, { opacity: 1 }, t + 2.15 + k * 0.11); sfx('key', t + 2.15 + k * 0.11, -25 - (k % 3), { el: c }); });
        const caret = sl.querySelector('.caret');
        // caret blinks until the end of the card and finishes visible (clean loop frame)
        const blinks = Math.floor((DUR[8] - 3.3) / 0.4);
        for (let k = 0; k < blinks; k++) tl.set(caret, { opacity: (blinks - k) % 2 ? 1 : 0 }, t + 3.1 + k * 0.4);
        const send = sl.querySelector('.cbox .send');
        tl.fromTo(send, { scale: 1 }, { scale: 0.86, duration: 0.1, yoyo: true, repeat: 1, ease: 'power2.out', immediateRender: false }, t + 3.15);
        sfx('click', t + 3.16, -23, { el: send });
        sfx('send-1', t + 3.22, -20, { el: send });                            // comment sent
        write(sl.querySelector('.note9'), t + 3.4, 1.0, -29);
        tl.fromTo(sl.querySelector('.rune.big'), { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'power2.inOut', immediateRender: true }, t + 3.9);
        sfx('shimmer', t + 3.9, -22);                                          // logo sting: sparkle over a soft low thump
        sfx('impact-1', t + 4.25, -25);
      },
    ];

    // ---------- assemble
    plan.forEach((p, k) => {
      const sl = slides[p.i];
      tl.set(sl, { autoAlpha: 1, zIndex: 1 }, p.enter);
      if (!ONLY && k > 0) {
        // swipe: previous card exits left, this one enters from the right (like a carousel)
        const prev = slides[plan[k - 1].i];
        tl.fromTo(sl, { xPercent: 100 }, { xPercent: 0, duration: TR, ease: 'snap', immediateRender: false }, p.enter);
        tl.to(prev, { xPercent: -100, duration: TR, ease: 'snap' }, p.enter);
        tl.set(prev, { autoAlpha: 0 }, p.enter + TR);
        boost.push([p.enter + 0.1, p.enter + TR - 0.1]);
        trim = 0;
        sfx('swipe', p.enter + 0.1, -19);                                       // whoosh peaks at the fastest frame (takes alternate)
      }
      trim = TRIM[p.i];
      BUILD[p.i](sl, p.t0);
    });
    tl.set({}, {}, total);
  });
})();
