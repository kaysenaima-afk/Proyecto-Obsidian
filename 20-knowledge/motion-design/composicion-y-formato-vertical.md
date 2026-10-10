---
title: "Composición y formato vertical 9:16"
created: 2026-10-10
updated: 2026-10-10
status: active
type: knowledge
area: motion-design
tags: [motion-design, composition, reels, safe-zones]
related: ["[[tipografia-cinetica]]", "[[principios-de-animacion-aplicados]]", "[[motion-studio]]"]
source: "Guías de safe zones de Reels 2026 (Hopper HQ, Adcreate, Moda) + práctica"
confidence: medium
---

## Qué es

Las reglas de layout, jerarquía, color y profundidad para un cuadro de 1080×1920 que se mira en un teléfono con la UI de la app encima.

## Por qué importa

En Reels/TikTok la UI tapa arriba (cuenta, audio), abajo (caption, CTA) y la derecha (likes, comentarios). Un texto perfecto bajo los botones no existe para el espectador. Además el feed recorta a 4:5 y la grilla del perfil a 1:1.

---

## Safe zones (1080×1920)

Meta las publica en porcentajes. Las cifras de terceros varían, así que usamos la intersección conservadora:

- **Arriba:** ~250 px (13%) libres
- **Abajo:** ~440 px (23%) libres. Lo más crítico.
- **Derecha:** ~140 px (13%) por la columna de botones
- **Izquierda:** ~60 px (5.5%)
- **Área segura resultante:** x 60–940, y 250–1480. El preview de motion-studio la muestra con la tecla **S**.

Para que funcione también en el recorte 4:5 del feed, el mensaje clave va entre y ≈ 420 y 1500.

## Jerarquía y color

- **Un foco por cuadro.** El ojo va primero a lo más grande, después a lo de más contraste, después a lo que se mueve.
- **60-30-10:** 60% fondo, 30% color secundario, 10% acento. En FYG: `#1A0A12` / `#631336` + `#F7D1DE` / `#C8F135`.
- **El acento se gana:** el verde ácido solo para la palabra clave, el CTA o el dato. Si todo es ácido, nada lo es.

## Profundidad (lo que separa lo "flat" de lo premium)

- **Parallax:** elementos de fondo (números fantasma, anillos) que se mueven más lento o en sentido contrario.
- **Cámara virtual:** `P.drift` constante (escala 1 → 1.04–1.08 por escena), `P.punch` en beats, `P.shake` en impactos.
- **Luz:** gradientes radiales en el fondo en vez de color plano. Vignette sutil (bajarla en fondos claros, porque los ensucia).
- **Textura:** grano en post (`post.grain` 8–12) unifica y da look "filmado". El motion blur real (`--mb 6`) da peso a cada movimiento.

---

## Gotchas

- Grano CSS/SVG dentro de la composición es caro (~45% más tiempo de render) y el motion blur lo promedia y lo apaga. Siempre en post.
- El grano pixel a pixel no comprime: un reel de 12 s pasó a 176 MB (117 Mbps). Grano a media resolución + techo de bitrate (20 Mbps) lo deja en ~30 MB sin perder el look.
- Los gradientes en fondos oscuros pueden hacer banding en H.264. El grano en post lo disimula.
- Probar en un teléfono real antes de publicar: las cifras de safe zone son aproximadas y cambian con las actualizaciones de la app.

## Conceptos conectados

[[tipografia-cinetica]] [[principios-de-animacion-aplicados]] [[transiciones]]

## Fuentes

- [Hopper HQ — Instagram Reel size 2026](https://www.hopperhq.com/blog/instagram-reel-size/) — porcentajes oficiales de Meta
- [Adcreate — Reel dimensions 2026](https://adcreate.com/blog/instagram-reel-dimensions-size-guide-2026) — márgenes en píxeles
- [Moda — story safe zone checker](https://moda.app/tools/story-safe-zone-checker) — márgenes medidos
