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
- **Editor de pantalla dividida:** listo. Talking head → transcripción con tiempos por palabra (Parakeet), cortes de silencio, encuadre por cara, plan de edición con 9 plantillas de B-roll, subtítulos, énfasis, transiciones, SFX y mezcla a −14 LUFS. Probado de punta a punta.
- **Carrusel animado FYG × Meta:** 9 slides del PDF reconstruidas en HTML y animadas. Un MP4 por slide (1080×1350) + versión continua con swipe. Espacios vacíos completados con datos verificados del anuncio de Meta (fuentes en `comps/meta-carrusel/FUENTES.md`).
- **Sonido profesional v2:** la v1 sintetizada fue rechazada ("suena a bip"). Rehecho con foley real (17 familias generadas en ElevenLabs y editadas con `sfxprep.py`), sincronía al golpe, niveles por LUFS, impacto en capas para celular y sala compartida. Stems WAV + videos con sonido + hojas de cues para el carrusel Meta. Alejandro elige y mezcla la música.
- **Próximo:** primer video real de Alejandro; plantillas de los estilos de voz en off A y B ([[estilos-de-referencia]]).

---

## Comandos

```bash
cd motion-studio && npm install
npm run preview                                   # http://localhost:5173/comps/<nombre>/
npm run analyze -- refs/referencia.mp4            # → analysis/referencia/report.md
node scripts/render.mjs comps/fyg-demo --still 1,4.5,8
node scripts/render.mjs comps/fyg-demo --scale 0.5          # draft rápido
node scripts/render.mjs comps/fyg-demo --mb 6 --audio tema.mp3
python3 -I scripts/prep.py refs/mi-video.mp4 --name mi-video --glossary "Cloud=Claude"   # talking head
npm run test:frames                               # regresión de timing
```

## Decisiones

- **HTML + GSAP en vez de Remotion:** mismo modelo técnico, sin licencia, y reutiliza el HTML del generador de carruseles. Ver [[herramientas-motion-code]].
- **Fuentes locales (@fontsource):** el render nunca depende de la red.
- **Grano en post, no en CSS:** 45% más rápido y el motion blur no lo apaga.
- **Timing en beats:** `b(n)` en vez de segundos, para cambiar de tema musical cambiando una constante.
- **ASR local con Parakeet (sherpa-onnx) desde GitHub:** HuggingFace está bloqueado en el entorno cloud; Parakeet TDT v3 da español con tiempos por palabra a ~8× tiempo real en CPU.
- **Foley generado y editado en vez de síntesis (v2 de sonido):** la síntesis simple da tonos puros que el oído lee como "bip"; las tomas de foley tienen la textura y microvariación de objetos reales. ElevenLabs es accesible por MCP y cuesta 50 créditos por toma; los bancos gratuitos (Freesound, Pixabay, Mixkit) están bloqueados en el entorno cloud.
- **Render en dos etapas (PNG → raw → mezcla):** Chromium alterna PNG RGB/RGBA según el contenido y eso reiniciaba el filtro de motion blur de ffmpeg, perdiendo frames. Lo detectó el test de regresión `test:frames`.

## Conectado con

[[motion-design-index]] [[workflow-recrear-video-referencia]] [[ritmo-y-sincronia-musical]]
