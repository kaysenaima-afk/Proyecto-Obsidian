---
title: "Tipografía cinética"
created: 2026-10-10
updated: 2026-10-10
status: active
type: knowledge
area: motion-design
tags: [motion-design, kinetic-typography, text-animation]
related: ["[[easing-y-timing]]", "[[composicion-y-formato-vertical]]", "[[motion-studio]]"]
source: "Práctica + tendencias 2026 (ikagency, trydemotion)"
confidence: high
---

## Qué es

Texto que se mueve para comunicar: el movimiento refuerza el significado (una palabra tachada, una cifra que crece, una idea que "golpea"). En video corto es el formato dominante porque funciona sin audio. La mayoría de la gente ve Reels en silencio.

## Por qué importa

El hook tiene que estar en movimiento desde el frame 1. La tipografía cinética entrega la propuesta de valor en los primeros 1–2 segundos aunque el video esté muteado.

---

## Catálogo de técnicas (preset en `lib/presets.js`)

| Técnica | Preset | Sensación | Cuándo |
|---|---|---|---|
| Line mask reveal | `P.lineReveal` | Editorial, premium | Titulares, hooks |
| Char cascade | `P.charCascade` | Enérgico, fluido | Palabra héroe, logo |
| Word pop | `P.wordPop` | Punchy, social | Frases cortas al beat |
| Blur in | `P.blurIn` | Suave, "keynote de Apple" | Subtítulos, captions |
| Scramble | `P.scramble` | Tech, decodificación | Kickers, labels, datos |
| Typewriter | `P.typewriter` | Conversacional, chat | Prompts, DMs, IA |
| Contador | `P.countUp` | Prueba, resultado | Cifras, métricas |
| Highlight marcador | `P.highlight` | Énfasis | La palabra clave de la frase |
| Strike-through | `P.strike` | Contraste "esto no / esto sí" | Objeciones, mitos |
| Fill the width | `P.fitText` | Impacto máximo | Cada línea ocupa todo el ancho |

## Reglas de legibilidad

- **Tiempo mínimo en pantalla:** 0.4 s + 0.25–0.3 s por palabra después de que termina de entrar. Un hook de 3 palabras necesita ~1.2–1.3 s quieto.
- **Una idea por pantalla.** Si hay que leer dos frases, son dos escenas.
- **Contraste de escala:** palabra clave 2–3× más grande que el resto. La jerarquía la hace el tamaño, no el color.
- **Fuentes condensadas** (Bebas Neue, Anton, Druk) para titulares en 9:16: entran más caracteres grandes por línea. Las extendidas (Syne 800) solo para palabras cortas o logos.
- **Nunca animar letra por letra un párrafo.** Letra por letra solo para 1–2 palabras; palabras para frases; líneas para bloques.

---

## En la práctica

Demo FYG: el hook "TU NEGOCIO / NO NECESITA / MÁS HORAS." usa `fitText` (cada línea llena el ancho seguro) + `lineReveal` una línea por beat + `strike` en el beat 3. "SISTEMAS" usa `charCascade` + `highlight` que invierte el color del texto.

```js
P.fitText(['#h1a', '#h1b', '#h1c'], { max: 320 });
tl.add(P.lineReveal('#h1a'), 0.1)
  .add(P.lineReveal('#h1b'), 0.5)
  .add(P.lineReveal('#h1c', { rotate: 4 }), 1.0)
  .add(P.strike('#strikeword'), 1.38);
```

## Gotchas

- Las máscaras de SplitText (`overflow:hidden`) cortan los acentos con line-height < 1. Los presets ya les dan padding. Si escribís CSS propio, recordalo.
- `fitText` y SplitText tienen que correr **después** de cargar las fuentes. El runtime ya espera `document.fonts.ready` antes de llamar a `build()`.
- Tildes y ñ: usar fuentes con subset latin completo (las de @fontsource lo traen).

## Conceptos conectados

[[easing-y-timing]] [[composicion-y-formato-vertical]] [[ritmo-y-sincronia-musical]]

## Fuentes

- [IK Agency — Kinetic typography guide 2026](https://www.ikagency.com/graphic-design-typography/kinetic-typography/) — el hook animado primero, legibilidad
- [Demotion — trending motion graphic styles 2026](https://trydemotion.com/blog/trending-motion-graphic-styles) — estilos vigentes
