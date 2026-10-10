---
title: "Estilos de referencia: 2 de voz en off + pantalla dividida"
created: 2026-10-10
updated: 2026-10-10
status: active
type: knowledge
area: motion-design
tags: [motion-design, reference, reels, voiceover, split-screen]
related: ["[[workflow-recrear-video-referencia]]", "[[tipografia-cinetica]]", "[[transiciones]]", "[[motion-studio]]"]
source: "3 videos enviados por Alejandro (2026-10-10), analizados con motion-studio/scripts/analyze.py"
confidence: high
---

## Qué es

El desglose de los tres formatos que Alejandro quiere producir. Dos son **voz en off con motion graphics puro** (A y B) y uno es **talking head en pantalla dividida** (C). Los números salen del analizador; lo visual, de leer las hojas de contacto cuadro por cuadro.

| | A · "Noticia cinematográfica" | B · "Editorial bento" | C · "Pantalla dividida" |
|---|---|---|---|
| Duración | 160 s | 77 s | 54 s |
| Planos / cortes | 32 planos, mediana 1.2 s | 1 plano continuo (todo animado) | 23 planos, 4.1 cortes/10 s |
| Música | ~138 BPM | ~160 BPM | ~122 BPM |
| Cortes en el beat | 52% | — | 59% |
| Fondo | navy/violeta con focos de luz | carbón cálido `#121210` | B-roll + speaker |
| Acentos | naranja + azul + violeta | naranja Claude | naranja |
| Tipografía | condensada bold mayúsculas | serif editorial + itálica | sans bold + serif itálica |
| Subtítulo | 1–2 palabras, palabra activa en caja de color | frase karaoke: gris → blanco, clave naranja | 1–3 palabras blancas en la costura |

---

## A · Noticia cinematográfica (voz en off)

- **Estructura:** capítulos numerados ("01/05 · EL LANZAMIENTO") en una barra superior fija con el logo del canal. Cada capítulo es una mini historia.
- **Titulares:** condensada bold en mayúsculas (tipo Bebas/Anton), en dos colores ("ANTHROPIC" naranja, "A OPENAI" azul) y entrando línea por línea.
- **Componentes:** logos enfrentados bajo focos de luz; contador grande + línea de tiempo (0 → 90 MIN); capturas de noticias con resaltador amarillo; tweets embebidos con su imagen; zócalo de persona (foto circular + nombre + cargo); gráficos de barras con la barra clave encerrada y flecha.
- **Subtítulo:** una o dos palabras en mayúsculas centradas abajo. La palabra clave lleva una caja de color (violeta/naranja) detrás.
- **Ritmo:** cambia de componente cada 1–2 s aunque la escena base no cambie (el fondo y la barra quedan fijos).

## B · Editorial bento (voz en off)

- **Look:** fondo carbón cálido, serif editorial (tipo Tiempos) para títulos, itálica naranja con subrayado a mano para la palabra clave ("Claude *Startups*", "Necesitas *tres* cosas").
- **Componentes:** etiqueta superior en versalitas naranja con tracking ("SI TE ACEPTAN", "EL PROCESO"); tarjetas bento que se suman de a una (ícono + etiqueta + número grande + bajada); contadores ($0 → $1.000, $0K → $45K); checklist con tildes; ventana de navegador que tipea la URL; formularios paso a paso con barra de progreso segmentada ("PASO 2 Y 3"); botón con cursor que hace clic.
- **Subtítulo:** la frase completa abajo. Las palabras pasan de gris a blanco a medida que se dicen y la clave queda en naranja.
- **Extras:** barra de progreso fina naranja abajo a la izquierda, mascota pixel arriba a la derecha.
- **Ritmo:** sin cortes; todo se construye y se transforma en una sola escena viva.

## C · Pantalla dividida (talking head) — implementado

- **Layouts:** `split` (B-roll arriba ~55% + speaker abajo), `speaker` a pantalla completa con zoom alternado (jump-cut punch-in), `broll` a pantalla completa, y `hook` de apertura (fondo claro, título, subtítulo que se tipea al hablar, speaker en tarjeta redondeada).
- **Subtítulos:** sans bold blanca con sombra, 1–3 palabras, en la costura entre B-roll y speaker; la palabra clave en color de acento. Desaparecen cuando entra un énfasis.
- **Énfasis:** palabras grandes en serif itálica blanca sobre el speaker ("y lo / mejor") o bold en acento ("Claude Code").
- **B-roll:** grabaciones de pantalla con paneo lento, capturas, íconos 3D sobre fondo claro que se deslizan, diagramas de flujo (raíz → 3 nodos), tarjetas de título.
- **Transiciones:** mayormente corte seco; algunas con zoom + blur, light leak cálido o whip con motion blur.
- **Ritmo:** cambio visual cada ~2 s (mediana 2.2 s).

---

## Cómo se produce cada uno

- **C:** `motion-studio` con `scripts/prep.py` + `lib/talk.js` (ver [[motion-studio]]). Alejandro manda su video hablando; prep transcribe, corta silencios y encuadra la cara; yo escribo el `plan.json` (B-roll y énfasis por frase) y renderizo.
- **A y B:** la misma base (transcripción con tiempos por palabra + subtítulos + plantillas). Falta escribir sus plantillas propias: barra de capítulo, focos, zócalo, gráficos y caja de palabra activa (A); tarjetas bento, karaoke gris→blanco y barra de progreso segmentada (B).

## Gotchas

- Las referencias vienen recomprimidas por TikTok a 576×1024. Los tamaños se escalan ×1.875 a 1080×1920.
- Los nombres propios en inglés salen mal transcriptos ("Cloud Code", "Timi"): siempre pasar un `--glossary`.
- No reutilizar footage, música ni logos de las referencias: se recrea el estilo, no el contenido.

## Conceptos conectados

[[workflow-recrear-video-referencia]] [[tipografia-cinetica]] [[transiciones]] [[ritmo-y-sincronia-musical]]
