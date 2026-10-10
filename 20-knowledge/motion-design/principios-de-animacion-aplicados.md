---
title: "Principios de animación aplicados a motion graphics"
created: 2026-10-10
updated: 2026-10-10
status: active
type: knowledge
area: motion-design
tags: [motion-design, principles, animation]
related: ["[[easing-y-timing]]", "[[motion-design-index]]", "[[tipografia-cinetica]]"]
source: "Disney 12 principles; práctica en motion-studio"
confidence: high
---

## Qué es

Los 12 principios de animación de Disney (Thomas & Johnston, 1981) son la "gramática profunda" de todo movimiento que se siente natural. En motion graphics no animamos personajes sino texto, formas e interfaces, pero los mismos principios explican por qué un movimiento se siente premium o barato.

## Por qué importa

Un movimiento lineal, sin anticipación ni asentamiento, el ojo lo lee como "máquina". Aplicar 3 o 4 de estos principios con sutileza es la diferencia entre un template de Canva y una pieza de estudio.

## Cómo se traduce cada principio

| Principio | En motion graphics | En código (GSAP / motion-studio) |
|---|---|---|
| Squash & stretch | Un botón o pastilla que se comprime al "aterrizar" | `scaleY` 0.9 → 1 con `settle` al final del pop |
| Anticipación | Retroceso de 2–4 frames antes del movimiento principal | ease `antic` o un tween corto en sentido contrario |
| Staging | Una sola idea por plano; todo lo demás se atenúa | bajar `opacity` del resto, vignette, foco con escala |
| Straight ahead / pose to pose | Siempre pose a pose: keyframes de estado A → B | tweens `from`/`to` entre estados definidos |
| Follow-through & overlap | Las partes no frenan juntas; el texto llega en cascada | `stagger` 0.03–0.1 s y curvas con overshoot leve |
| Slow in / slow out | Aceleración y frenado, nunca lineal | ver [[easing-y-timing]] — `glide`, `snap`, `whip` |
| Arcos | Movimientos curvos, no rectas | `MotionPathPlugin` o rotación + desplazamiento combinados |
| Acción secundaria | El fondo deriva mientras el texto entra | `P.drift` en el contenedor, parallax de elementos fantasma |
| Timing | La duración comunica peso y tamaño | objetos grandes = más lentos; micro-UI = 0.2–0.35 s |
| Exageración | Picos de escala o shake en el momento clave | `P.punch`, `P.shake`, flash en el drop |
| Volumen / solidez | Sombras, profundidad, capas | sombras suaves, blur de fondo, 2.5D con escala |
| Atractivo | Formas limpias, paleta controlada, ritmo | sistema de diseño + grilla de beats |

---

## Cuándo usarlos

- **Siempre:** slow in/out, timing, staging, overlap. Son la base, no un efecto.
- **Momentos clave:** anticipación, exageración, squash. Uno o dos por video, en el hook o en el reveal.

## Cuándo no

- **En UI funcional:** la anticipación y el rebote hacen sentir lenta una interfaz. En promos sí, en producto con mesura.
- **En marcas sobrias (legal, salud, finanzas):** overshoot casi nulo, curvas `glide`/`snap`, nada de `elastic`.

## En la práctica

En el demo de FYG (`motion-studio/comps/fyg-demo`): el strike-through sobre "MÁS HORAS" llega con `snap` y dispara un `shake` de 0.3 s (exageración + acción secundaria). Los chips entran en cascada (overlap). El fondo deriva todo el tiempo (acción secundaria). El "01" fantasma se mueve en sentido opuesto (parallax = volumen).

## Gotchas

- Overshoot por encima de ~8% se lee "cartoon". Para marcas premium mantenelo en 2–5%.
- La anticipación tiene que ser **más corta** que la acción (2–4 frames a 30 fps), si no parece un error.

---

## Conceptos conectados

[[easing-y-timing]] [[tipografia-cinetica]] [[transiciones]]

## Fuentes

- Thomas & Johnston, *The Illusion of Life* (1981) — origen de los 12 principios
- [Made Good Designs — Motion design principles](https://madegooddesigns.com/motion-design-principles/) — aplicación moderna y moderación
