---
title: "Sonido profesional para motion graphics"
created: 2026-10-10
updated: 2026-10-10
status: active
type: knowledge
area: motion-design
tags: [motion-design, sound-design, sfx, mixing, instagram]
related: ["[[ritmo-y-sincronia-musical]]", "[[motion-studio]]", "[[estilos-de-referencia]]", "[[composicion-y-formato-vertical]]"]
source: "Investigación 2026-10-10 (Material Design, Samsung One UI, guías de SFX y loudness) + práctica en motion-studio"
confidence: medium
---

## Qué es

El diseño sonoro de una pieza animada: efectos (SFX) sincronizados con cada movimiento, mezclados para convivir con la música y adaptados a cómo se escucha en redes (celular, muchas veces en mono). En motion-studio está implementado como librería sintetizada (`scripts/sfxlib.py`), partitura de cues por composición (`post.audio`) y mezclador (`scripts/mix.mjs`).

## Por qué importa

Una transición sin su whoosh se siente torpe y un pop atrae el ojo hacia lo que aparece. Pero el exceso cansa: los sonidos decorativos frecuentes generan fatiga y pierden peso. Lo profesional es usar pocos sonidos, bien elegidos y en el cuadro exacto.

---

## Principios (lo que aplicamos)

- **Una familia tonal:** todos los sonidos con altura afinados a la pentatónica de Do. Suenan como un mismo producto y armonizan con casi cualquier música.
- **Jerarquía:** las acciones principales (mensaje enviado o recibido, toggle, check, impacto, swipe) suenan más; las secundarias (whoosh, swish) menos; las texturas (scramble, lápiz, teclas) quedan apenas presentes. Un grupo de elementos lleva un solo sonido, no uno por elemento.
- **Duraciones de UI:** taps y clics de 30–150 ms; notificaciones de hasta ~500 ms más la cola.
- **Frecuencias:** corte por debajo de ~120 Hz en UI (salvo impactos); sin picos ásperos en 2–5 kHz; el contenido útil entre 700 Hz y 3 kHz, que es lo que reproduce bien un celular.
- **Sincronía:** el transitorio cae en el cuadro donde arranca la animación. El whoosh tiene su pico en el medio del movimiento y dura casi lo mismo que el movimiento.
- **Variaciones:** 2–6 versiones de cada sonido frecuente, rotadas, para que las repeticiones no suenen a ametralladora.
- **Espacio:** el estéreo sigue a la pantalla (enviado a la derecha, recibido a la izquierda, swipe de derecha a izquierda).

## Trampas técnicas que medimos

- **Mono:** el parlante del celular es mono. El ensanchado Haas (retrasar un canal 0,35 ms) cancela tonos de ~1,4 kHz al sumarse a mono: los pops quedaban con correlación L/R de -0,89. La solución es nada de Haas en sonidos tonales y ruido estéreo decorrelado para dar amplitud. Verificar siempre que la correlación L/R sea mayor que 0.
- **Impactos en el celular:** un golpe con 99,9% de energía por debajo de 120 Hz no se escucha en un celular (perdía 14,5 dB en la simulación). Se resuelve agregando cuerpo en 150–600 Hz, un "crack" en 1–4 kHz y saturación para generar armónicos (pérdida de 9,4 dB).
- **Limitadores con ganancia de compensación:** el `Limiter` de pedalboard (JUCE) sube la ganancia solo. Para stems usar un limitador transparente sin compensación.
- **Nivel entre slides:** con efectos escasos, el LUFS integrado engaña. Igualar por **máximo de corto plazo (3 s)** y recortar por slide (en el carrusel FYG: todas en ~-21 LUFS, con subas topeadas en +7 dB).

---

## Mezcla con música (guía rápida)

- **Stem de efectos:** ~-21 LUFS de corto plazo, picos entre -4 y -10 dBFS.
- **Música:** 12–16 dB por debajo de su master original; en los golpes el efecto tiene que salir por encima.
- **Exportación:** -14 LUFS integrado y ≤ -1 dBTP como referencia de facto para Reels (Instagram no publica una cifra oficial y las fuentes van de -10 a -16).
- **Ducking:** bajar la música 3–4 dB en los golpes clave.

## Instagram / Meta

- **Carrusel con videos + música desde la app:** según creadores, el audio de los videos se silencia (no hay doc oficial). Para tener música y efectos hay que mezclar afuera y subir sin música de la app.
- **Licencias:** Meta Sound Collection es gratis para contenido y anuncios en plataformas Meta, y solo ahí. Mixkit permite uso comercial sin atribución. En Freesound la licencia va por sonido (CC0 sí; CC-BY-NC no para comercial). En Pixabay no confirmamos los términos para anuncios. Los SFX de motion-studio son sintetizados: propios, sin licencias.

## Herramientas en motion-studio

- `python3 -I scripts/sfxlib.py` → `assets/sfx/pro/` (38 sonidos, 18 familias, 48 kHz/24 bit).
- `sfx(name, at, vol, {dur, from})` en la composición → `post.audio` con `bus: 'sfx'`.
- `node scripts/mix.mjs comps/x [--query slide=N] --wav stem.wav [--video v.mp4 --mux v-sfx.mp4] [--cues cues.csv]` → stem, video con sonido sin re-render, y hoja de cues.

## Conceptos conectados

[[ritmo-y-sincronia-musical]] [[motion-studio]] [[estilos-de-referencia]] [[composicion-y-formato-vertical]]

## Fuentes

- [Material Design — Applying sound to UI](https://m2.material.io/design/sound/applying-sound-to-ui.html) — limitar sonido decorativo para evitar fatiga
- [Samsung One UI — Sound](https://developer.samsung.com/one-ui/sound-and-haptic/sound.html) — fatiga según frecuencia, registro y contexto
- [Violet Recording — How to design UI sounds](https://violetrecording.com/how-to-design-ui-sounds/) — duraciones de taps y notificaciones
- [SFX Engine — After Effects sound effects tutorial](https://sfxengine.com/blog/after-effects-sound-effects-tutorial) — alinear el transitorio al keyframe
- [Pixflow — Cinematic whoosh sound effects](https://pixflow.net/blog/cinematic-whoosh-sound-effects/) — duración del whoosh igual a la del movimiento, 10–20 ms antes
- [Storyblocks — Guide to sound effects](https://www.storyblocks.com/resources/?p=435) — un sonido a la vez, no saturar
- [Lindsey Gamble — Music on video carousels](https://www.lindseygamble.com/blog/instagram-now-lets-users-add-music-to-video-carousels) — la música de la app silencia el audio de los videos
- [Metricool — Add music to Instagram posts](https://metricool.com/how-to-add-music-to-instagram-posts/) — música en carruseles solo desde el celular
- [APU Software — Social media loudness](https://apu.software/tiktok-instagram-reels-loudness/) y [Cutscore — -14 LUFS para Reels](https://cutscore.io/blog/loudness-for-instagram-reels) — objetivos de loudness (no oficiales)
- [Deckready — Reels audio](https://deckready.club/en/blog/instagram-reels-audio-en) — música 12–14 dB bajo la voz (regla práctica)
- [Audiodrome — Meta Sound Collection license](https://audiodrome.net/for-creators/facebook-music-licensing-faqs/) y [KillTheDJ — Meta Sound Collection](https://killthedj.com/meta-sound-collection/) — alcance de la licencia de Meta
- [Foxi Music — Royalty free for commercial use](https://www.foximusic.com/blog/royalty-free-music-for-commercial-use-guide/) — Mixkit y CC
- [Cinevva — Free SFX and music](https://app.cinevva.com/guides/free-sound-effects-music) — licencias de Freesound y Pixabay
- [ElevenLabs — Commercial sound effects](https://elevenlabs.io/sound-effects/commercial) — alternativa de SFX generados por IA (planes pagos sin atribución)
- [Epidemic Sound — Music for explainer videos](https://www.epidemicsound.com/blog/part-one-a-guide-to-picking-the-best-music-for-explainer-videos/) y [Soundverse — Music for SaaS](https://www.soundverse.ai/blog/article/ai-music-for-saas-marketing-videos-0213) — 100–125 BPM, minimal, sin competir con el mensaje
