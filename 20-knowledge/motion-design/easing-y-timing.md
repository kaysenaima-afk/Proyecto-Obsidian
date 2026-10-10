---
title: "Easing y timing"
created: 2026-10-10
updated: 2026-10-10
status: active
type: knowledge
area: motion-design
tags: [motion-design, easing, timing, graph-editor]
related: ["[[principios-de-animacion-aplicados]]", "[[ritmo-y-sincronia-musical]]", "[[motion-studio]]"]
source: "Práctica + docs de After Effects (speed/value graph) + GSAP CustomEase"
confidence: high
---

## Qué es

**Timing** es cuánto dura un movimiento; **easing** es cómo se distribuye la velocidad dentro de esa duración. Con la misma duración, la curva cambia por completo la sensación: suave, agresiva, pesada, elástica.

## Por qué importa

Es el 80% del "feeling" de un motion. Los estudios top usan pocas curvas, muy marcadas: entradas que frenan largo y movimientos entre estados con aceleración y frenado fuertes. Lo amateur usa `ease-in-out` suave para todo.

## Cómo funciona

- **Value graph (AE):** valor de la propiedad en el tiempo. Pendiente = velocidad.
- **Speed graph (AE):** velocidad en el tiempo. Un pico alto y angosto = movimiento "snappy". Es la forma más rápida de leer una curva ajena.
- **Influence (AE):** 33% = Easy Ease default (blando). 75–90% = curva de estudio. Nuestros eases replican eso con `cubic-bezier`.

---

## Curvas con nombre (registradas en `motion-studio/lib/presets.js`)

| Nombre | cubic-bezier | Equivalente AE | Uso |
|---|---|---|---|
| `glide` | 0.22, 1, 0.36, 1 | out 0% / in ~90% | Entradas de texto y elementos. Default. |
| `snap` | 0.76, 0, 0.24, 1 | Easy Ease, influence ~75% | Mover algo entre dos estados en reposo, wipes, highlights |
| `whip` | 0.9, 0, 0.1, 1 | influence ~95% | Transiciones; el frame del medio es puro blur |
| `settle` | path con overshoot ~4% | overshoot con expresión | Pop-ins, pastillas, CTA |
| `antic` | path con wind-up −14% y overshoot | anticipación + rebote | Solo momentos héroe |
| `exit` | 0.6, 0, 0.9, 0.4 | in 80% / out 0% | Elementos que salen de cuadro |

## Reglas de dirección

- **Entra con ease-out** (`glide`): llega rápido y frena; se siente responsivo.
- **Sale con ease-in** (`exit`): arranca lento y se va acelerando fuera de cuadro.
- **Se mueve entre estados con in-out** (`snap`): ambos extremos en reposo.
- **Nunca `linear`**, salvo derivas continuas de cámara, rotaciones de fondo y contadores de reloj.

## Duraciones de referencia (30 fps)

| Elemento | Duración | Frames |
|---|---|---|
| Micro (ícono, chip, check) | 0.2–0.35 s | 6–10 |
| Línea de texto entrando | 0.6–0.9 s | 18–27 |
| Stagger entre líneas / palabras / letras | 0.08 / 0.06 / 0.02–0.035 s | — |
| Elemento grande o escena moviéndose | 0.7–1.0 s | 21–30 |
| Transición entre escenas | 0.4–0.8 s | 12–24 |
| Deriva de cámara | toda la escena | — |

La duración escala con la distancia y el tamaño: un ícono que se mueve 20 px y un panel que cruza 1080 px **no** comparten duración.

---

## Gotchas

- La curva se siente distinta con motion blur: con `whip` y blur a 180° el frame central queda "smear", que es exactamente el look de estudio. Sin blur, la misma curva parece un salto.
- Con pocas muestras de blur (6), un `whip` que cruza la pantalla deja copias escalonadas. Declarar ese tramo en `post.blurBoost` (16 muestras) lo vuelve un smear continuo y solo cuesta ~30% más de render.
- Encadenar dos `glide` seguidos produce "frenar, arrancar, frenar". Para movimientos compuestos usá un solo tween con keyframes, o `snap`.
- Los eases con overshoot (`settle`, `back.out`) pueden sacar texto de la máscara: dale padding a la máscara (ya resuelto en presets).

## Conceptos conectados

[[principios-de-animacion-aplicados]] [[ritmo-y-sincronia-musical]] [[transiciones]]

## Fuentes

- [Adobe — Speed graph en After Effects](https://helpx.adobe.com/after-effects/using/speed.html) — value vs speed graph
- [Playbooks — slow in/out mastery](https://playbooks.com/skills/dylantarre/animation-principles/slow-in-out-mastery) — ease-out para entradas, ease-in para salidas
