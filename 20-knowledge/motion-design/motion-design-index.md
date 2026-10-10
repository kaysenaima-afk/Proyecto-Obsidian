---
title: "Motion design — índice"
created: 2026-10-10
updated: 2026-10-10
status: active
type: index
area: motion-design
tags: [index, motion-design, motion-graphics, video]
related: ["[[motion-studio]]", "[[workflow-recrear-video-referencia]]"]
source: ""
confidence: high
---

## Qué cubre esta área

Motion design y motion graphics para video corto de marketing (Reels, TikTok, Shorts, anuncios, promos de servicios/SaaS): principios de animación, curvas y timing, tipografía cinética, transiciones, ritmo musical, composición vertical y el pipeline de código para producirlo ([[motion-studio]]). Queda afuera: 3D pesado, VFX de cine y animación de personajes.

## Conceptos núcleo

- [[principios-de-animacion-aplicados]] — los 12 principios de Disney traducidos a gráficos y a código
- [[easing-y-timing]] — curvas, duraciones y por qué la curva carga el "feeling"
- [[tipografia-cinetica]] — catálogo de animaciones de texto y reglas de legibilidad
- [[transiciones]] — cómo pasar de una escena a otra sin que se note el corte
- [[ritmo-y-sincronia-musical]] — BPM, grilla de beats y diseño sonoro

## Cómo encajan las piezas

El **ritmo** (BPM) define la grilla temporal. Sobre esa grilla, el **timing** decide cuánto dura cada movimiento y el **easing** cómo se siente. Los **principios** dan peso y vida a cada movimiento. La **tipografía cinética** y las **transiciones** son los dos vocabularios más usados en video corto. La **composición** asegura que todo se lea en 9:16 con la UI encima. El **workflow** une todo para recrear cualquier referencia.

---

## Patrones prácticos

- [[composicion-y-formato-vertical]] — safe zones, jerarquía, profundidad y cámara virtual
- [[workflow-recrear-video-referencia]] — de un video de referencia a un MP4 propio, paso a paso
- [[herramientas-motion-code]] — GSAP/motion-studio vs Remotion vs HyperFrames vs After Effects
- [[estilos-de-referencia]] — los 3 formatos de Alejandro: noticia cinematográfica, editorial bento, pantalla dividida

## Errores comunes

- **Todo con la misma curva y duración:** se ve robótico. Variá duración según distancia y tamaño; usá 3–4 curvas con nombre, no una.
- **Movimiento sin motivo:** cada animación tiene que guiar la mirada o reforzar el mensaje. Si no, sacala.
- **Texto que no se llega a leer:** respetá el tiempo mínimo en pantalla (ver [[tipografia-cinetica]]).
- **Ignorar el audio:** la mitad de la percepción de "calidad" del motion es el sonido (ver [[ritmo-y-sincronia-musical]]).
- **Texto bajo la UI de Reels:** el 23% inferior y la franja derecha están tapados (ver [[composicion-y-formato-vertical]]).

---

## Recursos que formaron este conocimiento

- [HyperFrames / HeyGen — HTML to video](https://www.heygen.com/research/html-to-video) — render determinístico por seek de timeline
- [Remotion + GSAP](https://www.remotion.dev/docs/gsap) — mismo modelo de timeline pausado y seek por frame
- [Codrops — plugins gratuitos de GSAP](https://tympanus.net/codrops/?p=93244) — SplitText, MorphSVG, DrawSVG ahora gratis
- [Hopper HQ — tamaño y safe zones de Reels](https://www.hopperhq.com/blog/instagram-reel-size/) — márgenes de Meta en porcentajes

## Áreas relacionadas

[[motion-studio]] [[workflow-recrear-video-referencia]]

## Preguntas abiertas

- Morphing de formas complejas (MorphSVG) y su costo de render
- 2.5D / Three.js dentro de una composición sin romper el determinismo
