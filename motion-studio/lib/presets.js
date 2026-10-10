/*
 * motion-studio presets (classic script — load after gsap + plugins, before runtime.js).
 *
 * Every preset RETURNS a timeline/tween; you decide where it goes:
 *     tl.add(P.lineReveal('.title'), 0.3)
 *     tl.add(P.pushTransition('#s1', '#s2'), '+=0.2')
 *
 * Named eases (registered globally, usable as ease: 'snap' anywhere):
 *   glide   — long ease-out, the default "premium" entrance (AE: out 0 / in 90%)
 *   snap    — strong ease-in-out for moves between two resting states
 *   whip    — extreme in-out for transitions; the middle is where motion blur lives
 *   settle  — ease-out with a small overshoot (pop-ins, landing elements)
 *   antic   — anticipation wind-up + overshoot (hero moments only)
 *   exit    — ease-in for things leaving the frame
 */
(function () {
  'use strict';

  const plugins = [
    window.SplitText, window.CustomEase, window.DrawSVGPlugin, window.MorphSVGPlugin,
    window.ScrambleTextPlugin, window.TextPlugin, window.MotionPathPlugin, window.CustomWiggle,
  ].filter(Boolean);
  gsap.registerPlugin(...plugins);

  if (window.CustomEase) {
    CustomEase.create('glide', '0.22, 1, 0.36, 1');
    CustomEase.create('snap', '0.76, 0, 0.24, 1');
    CustomEase.create('whip', '0.9, 0, 0.1, 1');
    CustomEase.create('settle', 'M0,0 C0.18,0.9 0.32,1.08 0.55,1.04 0.74,1.01 0.86,1 1,1');
    CustomEase.create('antic', 'M0,0 C0.18,-0.14 0.34,-0.14 0.5,0.4 0.62,0.82 0.72,1.07 0.84,1.03 0.9,1.01 0.95,1 1,1');
    CustomEase.create('exit', '0.6, 0, 0.9, 0.4');
  }

  // SplitText masks clip with overflow:hidden; with tight display line-heights
  // that eats accents (Á, É) and descenders. Pad the masks, cancel with margins.
  const style = document.createElement('style');
  style.textContent = `.ms-line-mask, .ms-word-mask, .ms-char-mask { padding: 0.16em 0.04em 0.08em; margin: -0.16em -0.04em -0.08em; }`;
  document.head.appendChild(style);

  const toArray = (t) => gsap.utils.toArray(t);
  const ensureInline = (el) => { if (getComputedStyle(el).display === 'inline') el.style.display = 'inline-block'; };

  function split(target, type, extra) {
    return SplitText.create(target, Object.assign({ type, linesClass: 'ms-line', wordsClass: 'ms-word', charsClass: 'ms-char' }, extra));
  }

  const P = {
    split,

    /**
     * Size text so each element fills a target width on one line (classic
     * kinetic-type look). Call at build time — fonts are already loaded there.
     */
    fitText(target, o = {}) {
      toArray(target).forEach((el) => {
        el.style.whiteSpace = 'nowrap';
        el.style.display = 'inline-block';
        const width = o.width ?? el.parentElement.clientWidth;
        const size = parseFloat(getComputedStyle(el).fontSize);
        const next = Math.min(o.max ?? 600, Math.max(o.min ?? 10, size * (width / el.scrollWidth)));
        el.style.fontSize = next + 'px';
      });
    },

    // ---------------------------------------------------------------- TEXT
    /** Lines slide up from behind a mask. The workhorse of editorial kinetic type. */
    lineReveal(target, o = {}) {
      const s = split(target, 'lines', { mask: 'lines' });
      return gsap.timeline().from(s.lines, {
        yPercent: o.yPercent ?? 110, rotate: o.rotate ?? 0, duration: o.duration ?? 0.9,
        ease: o.ease ?? 'glide', stagger: o.stagger ?? 0.08,
      });
    },

    /** Words pop in with a little overshoot — punchy, social-style. */
    wordPop(target, o = {}) {
      const s = split(target, 'words');
      return gsap.timeline().from(s.words, {
        opacity: 0, scale: o.scale ?? 0.4, y: o.y ?? 40, duration: o.duration ?? 0.55,
        ease: o.ease ?? 'settle', stagger: o.stagger ?? 0.07, transformOrigin: '50% 80%',
      });
    },

    /** Characters cascade up through a mask, with a slight rotation. */
    charCascade(target, o = {}) {
      const s = split(target, 'words,chars', { mask: 'chars' });
      return gsap.timeline().from(s.chars, {
        yPercent: o.yPercent ?? 120, rotate: o.rotate ?? 8, duration: o.duration ?? 0.7,
        ease: o.ease ?? 'glide', stagger: o.stagger ?? 0.022,
      });
    },

    /** Letters drop in with blur — soft, "Apple keynote" feel. */
    blurIn(target, o = {}) {
      const s = split(target, o.by === 'words' ? 'words' : 'words,chars');
      const items = o.by === 'words' ? s.words : s.chars;
      return gsap.timeline().from(items, {
        opacity: 0, filter: `blur(${o.blur ?? 18}px)`, y: o.y ?? 20, scale: o.scale ?? 1.15,
        duration: o.duration ?? 0.9, ease: o.ease ?? 'glide', stagger: o.stagger ?? 0.03,
      });
    },

    /** Characters scramble into the final text (needs ScrambleTextPlugin). */
    scramble(target, o = {}) {
      const el = toArray(target)[0];
      const text = o.text ?? el.textContent;
      return gsap.timeline().fromTo(el, { scrambleText: { text: ' ', chars: o.chars ?? 'upperCase' } }, {
        duration: o.duration ?? 1.1, ease: 'none',
        scrambleText: { text, chars: o.chars ?? 'upperCase', revealDelay: o.revealDelay ?? 0.25, speed: o.speed ?? 0.6 },
      });
    },

    /** Typewriter with a blinking caret, frame-accurate. */
    typewriter(target, o = {}) {
      const el = toArray(target)[0];
      const s = split(el, 'chars');
      const caret = document.createElement('span');
      caret.className = 'ms-caret';
      caret.textContent = o.caret ?? '|';
      el.appendChild(caret);
      const cps = o.cps ?? 18;
      const tl = gsap.timeline();
      tl.set(s.chars, { opacity: 0 });
      s.chars.forEach((c, i) => tl.set(c, { opacity: 1 }, i / cps));
      const typed = s.chars.length / cps;
      const blinks = Math.ceil((o.hold ?? 1) * 2);
      for (let i = 0; i < blinks; i++) tl.set(caret, { opacity: i % 2 ? 1 : 0 }, typed + i * 0.5);
      return tl;
    },

    /** Animated number. Text is rewritten every rendered frame (deterministic). */
    countUp(target, o = {}) {
      const el = toArray(target)[0];
      const state = { v: o.from ?? 0 };
      const fmt = (v) => {
        const n = Number(v.toFixed(o.decimals ?? 0));
        const body = n.toLocaleString(o.locale ?? 'es-AR', { minimumFractionDigits: o.decimals ?? 0, maximumFractionDigits: o.decimals ?? 0 });
        return (o.prefix ?? '') + body + (o.suffix ?? '');
      };
      el.textContent = fmt(state.v);
      return gsap.timeline().to(state, {
        v: o.to ?? 100, duration: o.duration ?? 1.4, ease: o.ease ?? 'glide',
        onUpdate: () => { el.textContent = fmt(state.v); },
      });
    },

    /** Marker-style highlight sweeping behind a word. */
    highlight(target, o = {}) {
      const tl = gsap.timeline();
      toArray(target).forEach((el, i) => {
        ensureInline(el);
        el.style.position = 'relative';
        el.style.zIndex = '0';
        const bg = document.createElement('span');
        Object.assign(bg.style, {
          position: 'absolute', left: '-0.08em', right: '-0.08em', top: o.top ?? '12%', bottom: o.bottom ?? '6%',
          background: o.color ?? '#C8F135', zIndex: '-1', transformOrigin: o.from === 'right' ? '100% 50%' : '0% 50%',
          borderRadius: o.radius ?? '0.08em',
        });
        el.appendChild(bg);
        tl.fromTo(bg, { scaleX: 0 }, { scaleX: 1, duration: o.duration ?? 0.55, ease: o.ease ?? 'snap' }, i * (o.stagger ?? 0.1));
        if (o.textColor) tl.to(el, { color: o.textColor, duration: 0.2, ease: 'none' }, i * (o.stagger ?? 0.1) + (o.duration ?? 0.55) * 0.35);
      });
      return tl;
    },

    /** Strike-through line drawn across text. */
    strike(target, o = {}) {
      const el = toArray(target)[0];
      ensureInline(el);
      el.style.position = 'relative';
      const line = document.createElement('span');
      Object.assign(line.style, {
        position: 'absolute', left: '-4%', width: '108%', top: '52%', height: o.thickness ?? '0.09em',
        background: o.color ?? '#C8F135', transformOrigin: '0% 50%', borderRadius: '99px',
      });
      el.appendChild(line);
      return gsap.timeline().fromTo(line, { scaleX: 0 }, { scaleX: 1, duration: o.duration ?? 0.45, ease: o.ease ?? 'snap' });
    },

    // ---------------------------------------------------------------- SHAPES / REVEALS
    /** Clip-path wipe in from a side: left | right | top | bottom. */
    wipeIn(target, o = {}) {
      const from = {
        left: 'inset(0% 100% 0% 0%)', right: 'inset(0% 0% 0% 100%)',
        top: 'inset(0% 0% 100% 0%)', bottom: 'inset(100% 0% 0% 0%)',
      }[o.from ?? 'left'];
      return gsap.timeline().fromTo(target, { clipPath: from }, {
        clipPath: 'inset(0% 0% 0% 0%)', duration: o.duration ?? 0.8, ease: o.ease ?? 'snap', stagger: o.stagger ?? 0,
      });
    },

    /** Clip-path wipe out toward a side. */
    wipeOut(target, o = {}) {
      const to = {
        left: 'inset(0% 100% 0% 0%)', right: 'inset(0% 0% 0% 100%)',
        top: 'inset(0% 0% 100% 0%)', bottom: 'inset(100% 0% 0% 0%)',
      }[o.to ?? 'right'];
      return gsap.timeline().fromTo(target, { clipPath: 'inset(0% 0% 0% 0%)' }, {
        clipPath: to, duration: o.duration ?? 0.7, ease: o.ease ?? 'snap',
      });
    },

    /** Circular iris reveal from a point (percentages of the element). */
    circleReveal(target, o = {}) {
      const at = `${o.x ?? '50%'} ${o.y ?? '50%'}`;
      return gsap.timeline().fromTo(target, { clipPath: `circle(0% at ${at})` }, {
        clipPath: `circle(${o.radius ?? '150%'} at ${at})`, duration: o.duration ?? 1, ease: o.ease ?? 'snap',
      });
    },

    /** Draw SVG strokes (paths, lines, circles). */
    draw(target, o = {}) {
      return gsap.timeline().fromTo(target, { drawSVG: o.from ?? '0%' }, {
        drawSVG: o.to ?? '100%', duration: o.duration ?? 1.2, ease: o.ease ?? 'snap', stagger: o.stagger ?? 0.1,
      });
    },

    /** Scale pop with overshoot. */
    popIn(target, o = {}) {
      return gsap.timeline().from(target, {
        scale: 0, rotate: o.rotate ?? -8, opacity: o.fade ? 0 : 1, duration: o.duration ?? 0.6,
        ease: o.ease ?? 'back.out(1.8)', stagger: o.stagger ?? 0.08, transformOrigin: o.origin ?? '50% 50%',
      });
    },

    /** Grid/list stagger from center, edges or a given index. */
    staggerIn(targets, o = {}) {
      return gsap.timeline().from(targets, {
        opacity: 0, y: o.y ?? 60, scale: o.scale ?? 0.9, duration: o.duration ?? 0.7, ease: o.ease ?? 'glide',
        stagger: { each: o.each ?? 0.06, from: o.from ?? 'start', grid: o.grid },
      });
    },

    // ---------------------------------------------------------------- TRANSITIONS
    /** Push: outgoing slides away, incoming slides in, same direction. dir: up | down | left | right. */
    pushTransition(outgoing, incoming, o = {}) {
      const axis = o.dir === 'left' || o.dir === 'right' ? 'xPercent' : 'yPercent';
      const sign = o.dir === 'down' || o.dir === 'right' ? 1 : -1;
      const d = o.duration ?? 0.8, ease = o.ease ?? 'whip';
      return gsap.timeline()
        .set(incoming, { autoAlpha: 1, [axis]: -sign * 100 })
        .to(outgoing, { [axis]: sign * 100, duration: d, ease }, 0)
        .to(incoming, { [axis]: 0, duration: d, ease }, 0)
        .set(outgoing, { autoAlpha: 0 });
    },

    /** Zoom-through: outgoing scales up and fades, incoming settles from smaller. */
    zoomTransition(outgoing, incoming, o = {}) {
      const d = o.duration ?? 0.8;
      return gsap.timeline()
        .set(incoming, { autoAlpha: 0, scale: o.inScale ?? 0.7 })
        .to(outgoing, { scale: o.outScale ?? 2.4, autoAlpha: 0, duration: d, ease: 'exit' }, 0)
        .to(incoming, { autoAlpha: 1, scale: 1, duration: d, ease: 'glide' }, d * 0.35);
    },

    /** Iris transition: incoming scene expands in a circle over the outgoing one. */
    irisTransition(outgoing, incoming, o = {}) {
      const at = `${o.x ?? '50%'} ${o.y ?? '50%'}`;
      return gsap.timeline()
        .set(incoming, { autoAlpha: 1, zIndex: 5, clipPath: `circle(0% at ${at})` })
        .to(incoming, { clipPath: `circle(150% at ${at})`, duration: o.duration ?? 0.9, ease: o.ease ?? 'snap' })
        .set(outgoing, { autoAlpha: 0 });
    },

    /** Solid color panel sweeps across, swapping scenes while it covers the frame. */
    panelSweep(panel, outgoing, incoming, o = {}) {
      const d = o.duration ?? 0.5;
      return gsap.timeline()
        .set(panel, { autoAlpha: 1, xPercent: -101 })
        .to(panel, { xPercent: 0, duration: d, ease: 'snap' })
        .set(outgoing, { autoAlpha: 0 })
        .set(incoming, { autoAlpha: 1 })
        .to(panel, { xPercent: 101, duration: d, ease: 'snap' }, '+=' + (o.hold ?? 0.04));
    },

    /** One-frame-ish flash hit (white by default) — use on beat drops. */
    flash(overlay, o = {}) {
      return gsap.timeline()
        .set(overlay, { autoAlpha: o.opacity ?? 0.9, background: o.color ?? '#fff' })
        .to(overlay, { autoAlpha: 0, duration: o.duration ?? 0.25, ease: 'power2.out' });
    },

    // ---------------------------------------------------------------- CAMERA
    /** Slow continuous camera push/drift (Ken Burns). Put it on a scene container. */
    drift(target, o = {}) {
      return gsap.timeline().fromTo(target, { scale: o.fromScale ?? 1, x: 0, y: 0 }, {
        scale: o.scale ?? 1.08, x: o.x ?? 0, y: o.y ?? 0, duration: o.duration ?? 4, ease: o.ease ?? 'sine.inOut',
      });
    },

    /** Deterministic camera shake (seeded), decaying over time. */
    shake(target, o = {}) {
      const rnd = MotionComp.mulberry32(o.seed ?? 7);
      const steps = Math.round((o.duration ?? 0.4) * (o.freq ?? 30));
      const amp = o.intensity ?? 18;
      const tl = gsap.timeline();
      for (let i = 0; i < steps; i++) {
        const k = 1 - i / steps;
        tl.to(target, {
          x: (rnd() * 2 - 1) * amp * k, y: (rnd() * 2 - 1) * amp * k, rotate: (rnd() * 2 - 1) * (o.rotate ?? 1.2) * k,
          duration: 1 / (o.freq ?? 30), ease: 'none',
        });
      }
      return tl.to(target, { x: 0, y: 0, rotate: 0, duration: 0.08, ease: 'power2.out' });
    },

    /** Punch-in zoom on a beat (scale bump then settle). */
    punch(target, o = {}) {
      return gsap.timeline()
        .to(target, { scale: o.scale ?? 1.12, duration: o.in ?? 0.08, ease: 'power2.out' })
        .to(target, { scale: 1, duration: o.out ?? 0.5, ease: 'glide' });
    },
  };

  window.MotionPresets = P;
})();
