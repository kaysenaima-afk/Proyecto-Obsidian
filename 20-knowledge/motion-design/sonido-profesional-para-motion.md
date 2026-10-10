---
title: "Sonido profesional para motion graphics"
created: 2026-10-10
updated: 2026-10-10
status: active
type: knowledge
area: motion-design
tags: [motion-design, sound-design, sfx, mixing, instagram]
related: ["[[ritmo-y-sincronia-musical]]", "[[motion-studio]]", "[[estilos-de-referencia]]", "[[composicion-y-formato-vertical]]"]
source: "Investigación 2026-10-10 (Material Design, Samsung One UI, guías de SFX y loudness) + práctica en motion-studio (v1 sintetizada rechazada → v2 foley grabado)"
confidence: medium
---

## Qué es

El diseño sonoro de una pieza animada: efectos (SFX) sincronizados con cada movimiento, mezclados para convivir con la música y adaptados a cómo se escucha en redes (celular, muchas veces en mono). En motion-studio está implementado como librería de foley editado (`scripts/sfxprep.py` → `assets/sfx/el/`), partitura de cues por composición (`post.audio`) y mezclador (`scripts/mix.mjs`).

## Por qué importa

Una transición sin su whoosh se siente torpe y un pop atrae el ojo hacia lo que aparece. Pero el exceso cansa: los sonidos decorativos frecuentes generan fatiga y pierden peso. Lo profesional es usar pocos sonidos, bien elegidos y en el cuadro exacto.

---

## Por qué la primera versión no alcanzó (análisis del rechazo)

La v1 (38 sonidos sintetizados, `scripts/sfxlib.py`) estaba bien sincronizada y era mono-safe, pero Alejandro la rechazó. Medida contra criterios de estudio:

| Métrica | v1 sintetizada | v2 foley editado |
|---|---|---|
| Familias de tono puro (planitud espectral ≈ 0) | 11 de 18: suenan a "bip" | Solo las que son tonales por naturaleza (campanita, notificación, burbuja) |
| Planitud espectral del stem (textura) | 0,000–0,04 | 0,08–0,17 en slides de UI |
| Picos del stem | -4 a -10 dBFS (tímido solo) | -1 dBFS |
| Tiempo en silencio | 35–64 %, huecos de hasta 3,8 s | 27–45 %, huecos de hasta 3 s (las pausas finales de lectura) |
| Pérdida al sumar a mono | ≤ 0,5 dB | ≤ 0,6 dB |

Conclusión: el problema no era el timing sino el **material**. Los sonidos de síntesis simple son demasiado "limpios": les falta el ruido, la textura y la microvariación de un objeto real. Eso es lo que el oído reconoce como profesional.

## Principios (lo que aplicamos en la v2)

- **Material real, no síntesis:** cada familia sale de tomas de foley (ElevenLabs text-to-sound, un sonido por prompt, prompts cortos y concretos: "Small metal padlock snapping shut, crisp mechanical click"). Después se **edita** como lo haría un editor de sonido: recorte al transitorio, limpieza de graves, cola con fade, estéreo controlado.
- **Sincronía al golpe, no al inicio del archivo:** se mide dónde "aterriza" cada archivo (el clic, el snap, el punto más fuerte del whoosh) y la composición alinea ESE instante con el cuadro. Un swish con 0,45 s de entrada arranca antes y aterriza justo cuando el titular se acomoda; un riser llega a su pico exactamente en el impacto.
- **Nivel por loudness, no por volumen a ojo:** cada archivo trae su loudness momentáneo medido; la composición pide un nivel objetivo en LUFS por cue. Así todas las variaciones de una familia suenan iguales y la jerarquía es numérica:
  - golpes protagonistas (impacto, notificación): -15 a -18
  - acciones (burbujas, toggles, candados, checks, teclas): -20 a -26
  - movimiento (swish de tarjetas y titulares): -24 a -30
  - textura (scramble, lápiz, "alguien está escribiendo"): -28 a -37
- **Capas para el celular:** un boom de cine no existe en un parlante de celular. El impacto se arma con dos tomas alineadas por el transitorio: boom grave + golpe con "crack" medio, más saturación paralela del grave. Pasó de perder 26 dB a 10–14 dB en la simulación de parlante.
- **Variaciones reales:** 9 pulsaciones de tecla distintas cortadas de una toma, 4 toques de pantalla, pops y switches con variaciones de ±1–2 semitonos (varispeed, como un sampler). Los checks de una lista suben un tono cada uno (corrida ascendente).
- **Un solo espacio:** todo el bus de efectos va a una sala corta y oscura a -20 dB (filtrada, angosta). Los sonidos dejan de cortar a silencio digital y suenan como un mismo objeto.
- **Estéreo que sigue a la pantalla:** el paneo se calcula de la posición real del elemento (±0,45, seguro en mono).
- **Lo de antes que sigue valiendo:** jerarquía (un sonido por grupo, no uno por elemento), duraciones de UI cortas, sin graves bajo ~120 Hz en UI, variaciones rotadas.

## Trampas técnicas que medimos

- **Mono:** el parlante del celular es mono. El ensanchado Haas (retrasar un canal 0,35 ms) cancela tonos de ~1,4 kHz al sumarse a mono: los pops quedaban con correlación L/R de -0,89. La solución es nada de Haas en sonidos tonales y ruido estéreo decorrelado para dar amplitud. Verificar siempre que la correlación L/R sea mayor que 0.
- **Impactos en el celular:** un golpe con 99,9% de energía por debajo de 120 Hz no se escucha en un celular (perdía 14,5 dB en la simulación). Se resuelve agregando cuerpo en 150–600 Hz, un "crack" en 1–4 kHz y saturación para generar armónicos (pérdida de 9,4 dB).
- **Limitadores con ganancia de compensación:** el `Limiter` de pedalboard (JUCE) sube la ganancia solo. Para stems usar un limitador transparente sin compensación.
- **Nivel entre slides:** con efectos escasos, el LUFS integrado engaña. Igualar por **máximo de corto plazo (3 s)** y recortar por slide, pero sin pedirle al limitador más de ~2 dB: las slides llenas de clics miden menos LUFS pero suenan con punch, y aplastarlas para igualar el número las arruina (carrusel FYG v2: -19 a -23 LUFS de corto plazo, picos -1 dBFS).
- **Archivos generados:** los MP3 del generador terminan con un clic en los últimos milisegundos (hay que descartarlos) y a veces traen varios eventos en una toma (un candado con tres golpes, nueve teclas): se cortan por evento.
- **Rate limit de ElevenLabs:** ~5 generaciones por minuto; con 4 variaciones en paralelo devuelve 429 (no cobra lo que no corrió).

---

## Mezcla con música (guía rápida)

- **Stem de efectos (v2):** picos en -1 dBFS, -19 a -23 LUFS de corto plazo.
- **Música:** arrancar 8–10 dB por debajo de su master (CapCut ≈ 30–40 %) con los efectos al 100 %; en los golpes el efecto tiene que salir por encima.
- **Exportación:** -14 LUFS integrado y ≤ -1 dBTP como referencia de facto para Reels (Instagram no publica una cifra oficial y las fuentes van de -10 a -16).
- **Ducking:** bajar la música 3–4 dB en los golpes clave.

## Instagram / Meta

- **Carrusel con videos + música desde la app:** según creadores, el audio de los videos se silencia (no hay doc oficial). Para tener música y efectos hay que mezclar afuera y subir sin música de la app.
- **Licencias:** Meta Sound Collection es gratis para contenido y anuncios en plataformas Meta, y solo ahí. Mixkit permite uso comercial sin atribución. En Freesound la licencia va por sonido (CC0 sí; CC-BY-NC no para comercial). En Pixabay no confirmamos los términos para anuncios. Los SFX de motion-studio v2 se generaron con ElevenLabs desde la cuenta de FYG: con plan pago se usan comercialmente sin atribución (en plan gratuito ElevenLabs pide atribución). La librería v1 (`sfxlib.py`) es 100 % propia.

## Herramientas en motion-studio

- `python3 -I scripts/sfxprep.py --report` → `assets/sfx/el/` (17 familias, 42 archivos, 48 kHz/24 bit) + `manifest.js` con golpe y loudness de cada archivo. Las tomas crudas y los prompts quedan en `assets/sfx/el/raw/` (`prompts.json`).
- `sfx(name, golpe_s, lufs, {el, dur, from})` en la composición → `post.audio` (ver `comps/meta-carrusel/anim.js`). `'check-2'` elige un archivo exacto; `name` solo rota las tomas.
- `post.space: -20` → sala compartida en la mezcla.
- `node scripts/mix.mjs comps/x [--query slide=N] --wav stem.wav [--video v.mp4 --mux v-sfx.mp4] [--cues cues.csv] [--space dB|off]` → stem, video con sonido sin re-render, y hoja de cues (arranque + golpe de cada sonido).
- v1 (síntesis, sin licencias): `python3 -I scripts/sfxlib.py` → `assets/sfx/pro/`.

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
