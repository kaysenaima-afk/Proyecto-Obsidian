---
title: "motion-studio"
created: 2026-10-10
updated: 2026-10-10
status: active
type: project
area: motion-design
tags: [project, motion-design, video, fyg]
related: ["[[motion-design-index]]", "[[workflow-recrear-video-referencia]]", "[[herramientas-motion-code]]"]
source: "motion-studio/"
confidence: high
---

## Objetivo

Producir motion graphics de calidad estudio para FYG y sus clientes (reels, promos, anuncios, carruseles animados) desde código. El renderizado es reproducible y se puede automatizar desde n8n.

## Estado

- **Pipeline de render:** listo. HTML + GSAP → MP4 frame a frame, con motion blur real, grano en post, audio y ProRes con alpha.
- **Analizador de referencias:** listo. Cortes, BPM, sincronía con el beat, paleta, hojas de contacto y curva de movimiento.
- **Librería de presets:** 24 animaciones (texto, formas, transiciones, cámara) + 6 curvas con nombre.
- **Demo FYG:** reel de 12 s a 120 BPM. Copia liviana en `motion-studio/examples/fyg-demo.mp4`; la versión full (20 Mbps) se regenera en `out/` con `--mb 6` en ~6 min.
- **Próximo:** recrear el video de referencia que mande Alejandro.

---

## Comandos

```bash
cd motion-studio && npm install
npm run preview                                   # http://localhost:5173/comps/<nombre>/
npm run analyze -- refs/referencia.mp4            # → analysis/referencia/report.md
node scripts/render.mjs comps/fyg-demo --still 1,4.5,8
node scripts/render.mjs comps/fyg-demo --scale 0.5          # draft rápido
node scripts/render.mjs comps/fyg-demo --mb 6 --audio tema.mp3
```

## Decisiones

- **HTML + GSAP en vez de Remotion:** mismo modelo técnico, sin licencia, y reutiliza el HTML del generador de carruseles. Ver [[herramientas-motion-code]].
- **Fuentes locales (@fontsource):** el render nunca depende de la red.
- **Grano en post, no en CSS:** 45% más rápido y el motion blur no lo apaga.
- **Timing en beats:** `b(n)` en vez de segundos, para cambiar de tema musical cambiando una constante.

## Conectado con

[[motion-design-index]] [[workflow-recrear-video-referencia]] [[ritmo-y-sincronia-musical]]
