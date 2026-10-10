---
title: "Workflow: recrear un video de referencia"
created: 2026-10-10
updated: 2026-10-10
status: active
type: knowledge
area: motion-design
tags: [motion-design, workflow, reverse-engineering, video]
related: ["[[motion-studio]]", "[[ritmo-y-sincronia-musical]]", "[[tipografia-cinetica]]", "[[transiciones]]"]
source: "Proceso propio con motion-studio"
confidence: high
---

## Qué es

El proceso para pasar de "quiero un video como este" a un MP4 propio con la marca del cliente. Se recrea la gramática de la referencia (ritmo, curvas, transiciones, jerarquía); el contenido no se copia.

## Por qué importa

Una referencia es un brief visual mucho más preciso que cualquier descripción. Descomponerla en datos (tiempos, cortes, BPM, paleta) evita el "se parece pero no se siente igual".

---

## Pasos

1. **Analizar** → `npm run analyze -- refs/video.mp4`. Genera hojas de contacto cada 0.25 s, frame de entrada/medio/salida de cada plano, curva de energía de movimiento, BPM, % de cortes sobre el beat y paleta.
2. **Descomponer** → leer las hojas y escribir el *breakdown*: lista de planos con tiempos, qué entra, cómo entra (técnica + curva estimada), transición de salida, tipografías (familia, peso, tracking, caja), paleta y textura.
3. **Tokens de estilo** → traducir a variables: colores, fuentes, BPM, curvas con nombre, duraciones típicas. Si la referencia usa otra marca, mapear sus roles de color a la paleta del cliente.
4. **Construir** → una composición en `comps/<nombre>/index.html` desde `_template`. Una `<section>` por escena, el timing escrito en beats, presets primero y código a medida solo donde la referencia lo pida.
5. **QA con stills** → `--still t1,t2,...` en los momentos clave y comparar lado a lado con los frames de la referencia (`shots/shot_XX_mid.png`). Iterar hasta que coincidan composición, tamaños y tiempos.
6. **Draft y final** → draft rápido `--scale 0.5`, final `--mb 6` (motion blur) + `post.grain` + `--audio`.
7. **Entrega** → H.264, 1080×1920, 30 fps, BT.709, `+faststart` (ya es el default del renderer).

## Cómo leer la curva de energía (`motion.png`)

- **Picos angostos y altos** → cortes secos o transiciones `whip`.
- **Mesetas** → movimiento continuo (derivas, loops, footage).
- **Valles planos** → *holds* (texto quieto para leer). Su duración dice cuánto tiempo de lectura da la referencia.
- **Picos alineados con los ticks azules** → edición al beat.

---

## Cómo estimar la curva de un movimiento desde frames

Mirar 3 frames consecutivos al inicio, al medio y al final del movimiento:

- Mucho desplazamiento al inicio y casi nada al final → ease-out (`glide`).
- Poco al inicio y al final, mucho en el medio → in-out (`snap`). Si el medio es un borrón → `whip`.
- Pasa del destino y vuelve → overshoot (`settle` / `back.out`).

## Gotchas

- Video de Instagram/TikTok por link: la descarga directa suele requerir login. Lo más confiable es subir el MP4 al chat o al repo (`motion-studio/refs/`, que está en `.gitignore`).
- Los videos re-comprimidos por las apps tienen fps variable y artefactos: la detección de cortes puede marcar falsos positivos en flashes. Ajustar con `--threshold`.
- No copiar assets, footage ni música con copyright de la referencia. Se recrea el estilo, no el contenido.

## Conceptos conectados

[[motion-studio]] [[ritmo-y-sincronia-musical]] [[tipografia-cinetica]] [[transiciones]] [[easing-y-timing]]

## Fuentes

- Proceso propio, validado con el demo FYG
