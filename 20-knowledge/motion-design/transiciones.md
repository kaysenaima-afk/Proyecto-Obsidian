---
title: "Transiciones en motion graphics"
created: 2026-10-10
updated: 2026-10-10
status: active
type: knowledge
area: motion-design
tags: [motion-design, transitions, editing]
related: ["[[easing-y-timing]]", "[[ritmo-y-sincronia-musical]]", "[[motion-studio]]"]
source: "Práctica de edición y motion"
confidence: high
---

## Qué es

El paso de una escena a otra. En motion graphics bien hecho la transición es parte de la narrativa: lleva la mirada de un punto al siguiente en vez de "cortar y empezar de nuevo".

## Por qué importa

Las transiciones definen el ritmo percibido del video. Una buena transición esconde el corte en el frame más rápido (donde el motion blur lo disimula) y aterriza en el beat.

## Cómo funciona

El truco universal es **esconder el cambio**. Algo cubre el cuadro por un instante (un panel, un blur, un flash, un objeto) o el movimiento es tan rápido que el ojo no registra el corte. Ahí se intercambian las escenas.

---

## Catálogo

| Transición | Preset | Cuándo |
|---|---|---|
| Corte seco al beat | (sin preset: cambiar `autoAlpha` en el beat) | La más usada. Ritmo alto, hooks |
| Push / slide | `P.pushTransition` | Secuencia lógica: paso 1 → paso 2 |
| Panel sweep | `P.panelSweep` | Cambio de tema o de color de fondo; muy de marca |
| Iris / círculo | `P.irisTransition` | Revelar desde un elemento (botón, punto, logo) |
| Zoom-through | `P.zoomTransition` | "Entrar" en una idea, profundidad |
| Wipe con clip-path | `P.wipeIn` / `P.wipeOut` | Revelar imágenes, screenshots, UI |
| Flash frame | `P.flash` | Drops musicales, impacto |
| Match cut / morph | MorphSVG o mismo elemento que cambia de rol | La más elegante: una forma se convierte en la escena siguiente |

## Reglas

- **Motivada:** la dirección de la transición sigue la dirección del movimiento previo (si el texto salió hacia arriba, la escena nueva entra desde abajo).
- **Corta:** 0.4–0.8 s. Más larga se siente template.
- **Curva `whip` o `snap`** para que el centro sea rápido y quede tapado por el motion blur.
- **Aterriza en el beat:** el *final* de la transición (cuando la escena nueva está en su lugar) cae sobre el beat, no el inicio.
- **Variedad con sistema:** 2–3 tipos de transición por video, repetidos con criterio. Diez tipos distintos = caos.

---

## En la práctica

Demo FYG: panel ácido (#C8F135) que barre de izquierda a derecha y revela la escena vino; iris rosa desde el centro hacia la escena de prueba; push vertical hacia el end card. Cada una termina exactamente en un beat de 120 BPM.

```js
tl.add(P.panelSweep('#panel', '#s1', '#s2', { duration: 0.42 }), b(5) - 0.42)
  .add(P.irisTransition('#s2', '#s3', { y: '55%', duration: 0.6 }), b(11) - 0.5)
  .add(P.pushTransition('#s3', '#s4', { dir: 'up', duration: 0.7 }), b(18) - 0.6);
```

## Gotchas

- `clip-path` animado es caro en render por software. Para fondos completos está bien; para decenas de elementos, preferí `transform`.
- Las escenas tienen que estar en `visibility:hidden` (`autoAlpha: 0`) cuando no se ven, no solo tapadas. Si no, se pintan igual y bajan la velocidad de render.

## Conceptos conectados

[[easing-y-timing]] [[ritmo-y-sincronia-musical]] [[composicion-y-formato-vertical]]

## Fuentes

- Práctica propia en [[motion-studio]]
