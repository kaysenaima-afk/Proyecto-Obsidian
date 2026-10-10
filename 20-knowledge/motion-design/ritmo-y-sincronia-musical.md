---
title: "Ritmo y sincronía musical"
created: 2026-10-10
updated: 2026-10-10
status: active
type: knowledge
area: motion-design
tags: [motion-design, rhythm, music, sound-design]
related: ["[[easing-y-timing]]", "[[transiciones]]", "[[workflow-recrear-video-referencia]]"]
source: "Práctica de edición + analizador de motion-studio"
confidence: high
---

## Qué es

Organizar el movimiento sobre la grilla temporal de la música: los cortes, las entradas de texto y los impactos caen sobre beats. El diseño sonoro (whooshes, impacts, clicks) termina de "pegar" el movimiento al audio.

## Por qué importa

Cuando el movimiento coincide con el audio, el cerebro lo percibe como intencional y de alta calidad. Un motion perfecto con audio desfasado se siente amateur. El analizador mide qué % de los cortes de una referencia cae sobre onsets: si es alto (>60%), el original está editado al beat y hay que replicarlo.

## Cómo funciona

- **Beat (s) = 60 / BPM.** A 120 BPM, 1 beat = 0.5 s = 15 frames a 30 fps.
- **Compás (4/4)** = 4 beats. Las frases musicales duran 4 u 8 compases. Los cambios grandes (nueva escena, reveal) van al inicio de frase.
- **Jerarquía de golpes:** downbeat (beat 1 del compás) → cambio de escena. Snare (beats 2 y 4) → entradas de texto, pops. Hi-hats (corcheas) → staggers, micro-movimientos.
- **El drop** (cuando entra todo) es el momento para el reveal principal + flash/punch/shake.

---

## Tabla rápida a 30 fps

| BPM | Beat (s) | Frames/beat | Uso típico |
|---|---|---|---|
| 90 | 0.667 | 20 | Corporativo, calmo, explicativo |
| 100 | 0.6 | 18 | Lifestyle, educativo |
| 120 | 0.5 | 15 | Promos, el estándar de Reels |
| 128 | 0.469 | 14.06 | House/EDM, energético |
| 140 | 0.429 | 12.86 | Trap/drill, muy rápido |

Si los frames por beat no son enteros (128 BPM), redondeá cada hit al frame más cercano. Nunca acumules el error.

## Diseño sonoro (capas)

- **Whoosh** en cada transición: empieza 2–4 frames antes, pico en el frame más rápido.
- **Impact/hit** en reveals y en el strike-through. **Riser** de 1–2 compases antes del drop.
- **Clicks/pops UI** en chips, checks y contadores (tick por cada salto grande).
- **Ducking:** la música baja 4–6 dB cuando hay voz en off.
- **Loudness para redes:** alrededor de −14 LUFS integrado y picos ≤ −1 dBTP.

---

## En la práctica

El demo FYG está construido sobre una constante `BEAT = 0.5` (120 BPM) y la función `b(n)` = n beats. Todo el timing se escribe en beats, así que cambiar a otro tema es cambiar una sola línea:

```js
const BEAT = 60 / 120;          // cambiar el BPM acá
const b = (n) => n * BEAT;
tl.add(P.lineReveal('#h1b'), b(1));
```

Render con música: `node scripts/render.mjs comps/fyg-demo --audio tema.mp3 --audio-start 12.0` (`--audio-start` arranca el tema en su drop o en su primer downbeat).

## Gotchas

- Detectar el BPM del tema antes de animar (`npm run analyze` sobre el audio o el video de referencia). Animar primero y buscar música después casi nunca sincroniza.
- Las transiciones **terminan** en el beat. Si empiezan en el beat, se sienten tarde.
- Instagram puede reemplazar o mutear audio con copyright. Para anuncios, usá música con licencia.

## Conceptos conectados

[[easing-y-timing]] [[transiciones]] [[workflow-recrear-video-referencia]]

## Fuentes

- Práctica propia; métricas de sincronía con `motion-studio/scripts/analyze.py`
