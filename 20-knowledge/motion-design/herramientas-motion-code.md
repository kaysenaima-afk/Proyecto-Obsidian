---
title: "Herramientas de motion graphics por código"
created: 2026-10-10
updated: 2026-10-10
status: active
type: connection
area: motion-design
tags: [motion-design, tooling, gsap, remotion, hyperframes]
related: ["[[motion-studio]]", "[[motion-design-index]]"]
source: "Comparativas 2026 (rendercomp, genmotion, voyager) + docs de Remotion y HyperFrames"
confidence: medium
---

## Qué compara

Las opciones para producir motion graphics de calidad estudio sin After Effects, o para automatizarlos (n8n, generación por lotes, agentes).

## Comparativa

| Herramienta | Modelo | Licencia | Fuerte en | Débil en |
|---|---|---|---|---|
| **motion-studio** (nuestro) | HTML + GSAP, seek por frame, Playwright + ffmpeg | Propio, sin costo | Control total, presets de marca, motion blur real, análisis de referencias | Sin editor visual, render por CPU |
| Remotion | React, `useCurrentFrame()` | Source-available, gratis hasta 3 personas, pago arriba | Ecosistema enorme, render en Lambda, video data-driven | Licencia paga para empresas, curva de React |
| HyperFrames (HeyGen) | HTML + atributos de tiempo + GSAP | Apache 2.0 | Overlays, captions, HTML escrito por agentes | Menos maduro para piezas complejas |
| Motion Canvas / Revideo | TypeScript con generadores | MIT | Explicadores técnicos, sincronía con voz | Revideo con mantenimiento incierto |
| Lottie / Rive | JSON vectorial / runtime interactivo | Abierto | Animación liviana para web y apps | No es un pipeline de video |
| After Effects | Timeline + graph editor | Suscripción Adobe | Lo más completo, plugins, 3D, tracking | Manual, no automatizable a escala |

## Cuándo usar cada una

- **motion-studio:** reels de marca, promos, carruseles animados, recrear referencias, generar variantes por lotes desde n8n.
- **Remotion:** cuando el video es parte de un producto React o hace falta render serverless masivo.
- **After Effects:** tracking de cámara, rotoscopia, 3D real o integración con footage complejo.

---

## Por qué construimos motion-studio en vez de usar Remotion

- **Mismo modelo técnico** (timeline GSAP pausado + seek por frame + captura headless + ffmpeg), sin dependencia de licencia.
- **HTML puro:** es el mismo lenguaje que ya usamos en el generador de carruseles de FYG (n8n + HTML → PNG), así que los estilos se reutilizan tal cual.
- **Extras de estudio** que no vienen por defecto: motion blur por subframes, grano en post, safe zones de Reels en el preview, analizador de referencias.

## Gotchas

- GSAP es 100% gratis desde la compra de Webflow, incluidos SplitText, MorphSVG, DrawSVG, ScrambleText y CustomEase, también para uso comercial.
- Cualquier herramienta de este tipo es determinística solo si se cumplen sus reglas: nada de `Math.random()`, `Date.now()` ni tweens fuera del timeline maestro.

## Conceptos conectados

[[motion-studio]] [[workflow-recrear-video-referencia]]

## Fuentes

- [Rendercomp — Best programmatic video tools 2026](https://rendercomp.com/blog/best-programmatic-video-tools-2026/)
- [GenMotion — HyperFrames alternatives](https://genmotion.dev/blog/hyperframes-alternatives)
- [HeyGen — HTML to video research](https://www.heygen.com/research/html-to-video) — trampas de captura (fuentes, rAF)
- [Remotion — GSAP timeline](https://www.remotion.dev/docs/gsap/use-gsap-timeline)
