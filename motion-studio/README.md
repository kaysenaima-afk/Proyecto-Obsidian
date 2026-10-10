# motion-studio

Estudio de motion graphics por código: composiciones en HTML + GSAP renderizadas frame a frame a MP4, con calidad de estudio (motion blur real, grano, color BT.709) y un analizador para descomponer videos de referencia.

Teoría y criterio: [`20-knowledge/motion-design/`](../20-knowledge/motion-design/motion-design-index.md).

## Instalación

```bash
cd motion-studio
npm install
# Solo fuera de este entorno (Mac/Windows), una vez:
npx playwright-core install chromium
```

Requiere Node 18+, ffmpeg y Python 3 con `pip install -r requirements.txt` (analizador y editor de pantalla dividida). El modelo de transcripción (~490 MB, Parakeet TDT v3 vía sherpa-onnx) se descarga solo la primera vez desde GitHub a `~/.cache/motion-studio/models/`.

## Uso

| Qué | Comando |
|---|---|
| Preview en vivo | `npm run preview` → abrir `http://localhost:5173/comps/fyg-demo/` |
| Stills para revisar | `node scripts/render.mjs comps/fyg-demo --still 1,4.5,8` |
| Draft rápido | `node scripts/render.mjs comps/fyg-demo --scale 0.5` |
| Final con motion blur | `node scripts/render.mjs comps/fyg-demo --mb 6` |
| Con música | `... --audio tema.mp3 --audio-start 12.0 --volume 0.9` |
| Overlay transparente | `... --alpha` → `.mov` ProRes 4444 |
| Analizar referencia | `npm run analyze -- refs/video.mp4` → `analysis/video/report.md` |

Atajos del preview: `Espacio` play/pausa · `←/→` frame a frame (`Shift` = 10 frames) · `S` safe zones de Reels · `G` grilla de tercios.

Otras opciones del render: `--fps`, `--from/--to` (segundos), `--crf` (16 por defecto), `--maxrate` (techo de bitrate, 20M por defecto), `--preset` (x264, `medium`), `--grain` (sobrescribe `post.grain`), `--boost` (muestras dentro de `post.blurBoost`, 16 por defecto), `--shutter` (0.5 = 180°), `--workers`, `--out`.

**Blur boost:** las transiciones muy rápidas (`whip`) con pocas muestras dejan copias fantasma. Declarás los tramos en la composición y solo esos frames usan más muestras, igual que el motion blur adaptativo de After Effects:

```js
const post = { grain: 10, blurBoost: [[2.06, 2.98], [8.38, 9.12]], boostSamples: 16 };
MotionComp.create({ ..., post }, build);
```

## Editor de pantalla dividida (talking head → reel)

Estilo "pantalla dividida": B-roll arriba, speaker abajo, subtítulos en la costura, énfasis en serif itálica, hook de apertura. Detalle del estilo en `20-knowledge/motion-design/estilos-de-referencia.md`.

```bash
# 1. Preparar: transcribe (Parakeet, tiempos por palabra), corta silencios, encuadra la cara, borrador del plan
python3 -I scripts/prep.py refs/mi-video.mp4 --name mi-video --glossary "Cloud Code=Claude Code;Cloud=Claude"
# 2. Assets de B-roll (opcional): capturas → assets/, grabaciones → secuencias de frames
python3 -I scripts/asset.py comps/mi-video captura.png
python3 -I scripts/asset.py comps/mi-video demo.mov --as demo --start 3 --dur 6
# 3. Editar comps/mi-video/plan.json (leer transcript.txt) y revisar con stills
node scripts/render.mjs comps/mi-video --still 1.5,4,8
# 4. Render final (voz + SFX + música, -14 LUFS)
node scripts/render.mjs comps/mi-video
```

Opciones de `prep.py`: `--gap 0.4` (silencios más largos se cortan), `--pad 0.08` (aire alrededor de la voz), `--no-cut`, `--theme fyg|ref`, `--music tema.mp3`, `--force` (regenera el borrador del plan).

### plan.json

```jsonc
{
  "theme": { "accent": "#C8F135", "brand": "#631336", "light": "#F3EEF0", "dark": "#120910", "ink": "#1A0A12" },
  "music": "media/tema.mp3", "musicVolume": 0.12, "sfx": true,
  "highlightWords": ["Claude", "gratis"],          // palabras en color de acento en los subtítulos
  "segments": [
    { "start": 0,   "layout": "hook", "title": "Claude Code sin límites", "titleWords": 0, "image": "assets/ilustracion.png" },
    { "start": 3.0, "layout": "split",   "broll": { "type": "terminal", "lines": ["$ claude", "⚠ Usage limit reached"] } },
    { "start": 4.4, "layout": "split",   "broll": { "type": "flow", "root": "Claude Code", "nodes": ["DeepSeek", "Kimi", "GLM"], "tag": "FREE" } },
    { "start": 7.0, "layout": "speaker", "overlay": { "text": "sin parar|tu sesión", "style": "serif", "at": 8.3 } },
    { "start": 9.6, "layout": "broll",   "transition": "whip", "broll": { "type": "icon", "items": [{ "label": "Claude", "glyph": "✳", "color": "#E8793A" }] } }
  ]
}
```

- **layout:** `split` · `speaker` (pantalla completa; el zoom alterna 1 / 1.14 solo) · `broll` · `hook`
- **broll.type:** `image` (`src`, `motion`: push · scroll · pan-left · pan-right · none, `fit`) · `clip` (frames de `asset.py`) · `icon` (`items` [{label, glyph | image, color}], carrusel) · `title` (`text`, `sub`, `style`: sans · serif) · `list` (`title`, `items`) · `stat` (`value`, `prefix`, `suffix`, `label`) · `flow` (`root`, `nodes`, `tag`) · `browser` (`url`, `title`, `image`, `button`) · `terminal` (`lines`)
- **broll.bg:** `dark` · `light` · `brand` · `accent`
- **overlay:** `text` (`|` = salto de línea), `style` (serif · bold · outline), `at` (segundo exacto), `y` (0–1)
- **transition:** `cut` (default) · `zoom` · `leak` · `whip` · `flash` — con whoosh automático y blur boost
- **por segmento:** `zoom` (forzar zoom del speaker), `captions: false`

El motor (`lib/talk.js`) sincroniza los frames del speaker por seek. Los subtítulos salen de `words.json`, el audio se mezcla en el render (voz + música en loop + SFX de `assets/sfx/`) y se normaliza a −14 LUFS / −1 dBTP.

## Carrusel animado (PDF / slides → videos por slide)

Ejemplo: `comps/meta-carrusel/` (carrusel FYG × Meta, 9 slides 1080×1350).

1. Rasterizar el PDF (`pdftoppm -png -scale-to-x 1080 -scale-to-y 1350 carrusel.pdf page`) y medir posiciones/colores.
2. Reconstruir cada slide en HTML (una `<section class="slide">` por slide) con las mismas fuentes; logos/marcas se extraen del PDF como máscaras alpha.
3. Coreografía en `anim.js`: cada slide entra por partes y termina en su diseño estático (sirve de loop).
4. Render: `--query slide=N` → un MP4 por tarjeta del carrusel (sin audio, la música se agrega en la app); sin query → versión continua con swipe + SFX.

```bash
for n in 1 2 3 4 5 6 7 8 9; do node scripts/render.mjs comps/meta-carrusel --query slide=$n --mb 4 --out out/meta-carrusel/slide-0$n.mp4; done
node scripts/render.mjs comps/meta-carrusel --mb 4 --out out/meta-carrusel/carrusel-completo.mp4
```

## Diseño sonoro (SFX propios + stems)

- `python3 -I scripts/sfxlib.py` genera `assets/sfx/pro/`: 38 efectos sintetizados (pop, send, receive, key, toggle, lock, check, whoosh, swipe, impact, riser, swish, scramble, scribble, notify, buzz, shimmer, click), afinados en pentatónica de Do, seguros en mono y probados para parlante de celular. Son propios: sin licencias.
- En la composición: `sfx(nombre, segundo, volumen, { dur, from })` → `post.audio` (`bus: 'sfx'`), con variaciones rotadas.
- Mezcla sin re-renderizar: `node scripts/mix.mjs comps/x --query slide=3 --wav stems/s3.wav --video v.mp4 --mux v-con-sonido.mp4 --cues stems/s3-cues.csv`. El stem sale sin normalizar (para balancear con música), con limitador transparente a -1 dBFS; imprime pico, LUFS integrado y máximo de corto plazo.
- Guía de mezcla con música: `comps/meta-carrusel/GUIA-DE-MEZCLA.md`. Teoría: `20-knowledge/motion-design/sonido-profesional-para-motion.md`.

## Crear una composición

1. Copiá `comps/_template/` a `comps/<nombre>/`.
2. Una `<section class="scene">` por escena; estilos con variables CSS de la marca.
3. Animá dentro de `MotionComp.create(config, (tl, { P, random }) => { ... })`:

```js
const BEAT = 60 / 120, b = (n) => n * BEAT;   // timing en beats
MotionComp.create({ width: 1080, height: 1920, fps: 30, duration: 12, post: { grain: 10 } }, (tl, { P }) => {
  P.fitText('#titulo', { max: 300 });
  tl.add(P.lineReveal('#titulo'), b(0))
    .add(P.highlight('#clave', { textColor: '#1A0A12' }), b(2))
    .add(P.panelSweep('#panel', '#s1', '#s2'), b(4) - 0.5);
});
```

### Reglas de determinismo

- Todo tween va dentro de `tl` (nunca `gsap.to()` suelto).
- Nada de `Math.random()` / `Date.now()` / `setTimeout`: usá el `random` con semilla que recibe `build()`.
- Las animaciones CSS `@keyframes` están permitidas (el runtime las pausa y las posiciona en cada frame).
- `<video data-sync data-offset="1.5">` se sincroniza frame a frame (para footage o grabaciones de pantalla).

## Presets (`lib/presets.js`)

- **Texto:** `fitText`, `lineReveal`, `charCascade`, `wordPop`, `blurIn`, `scramble`, `typewriter`, `countUp`, `highlight`, `strike`
- **Formas / reveals:** `wipeIn`, `wipeOut`, `circleReveal`, `draw` (SVG), `popIn`, `staggerIn`
- **Transiciones:** `pushTransition`, `zoomTransition`, `irisTransition`, `panelSweep`, `flash`
- **Cámara:** `drift`, `shake` (con semilla), `punch`
- **Curvas:** `glide`, `snap`, `whip`, `settle`, `antic`, `exit` (ver `20-knowledge/motion-design/easing-y-timing.md`)

## Cómo funciona

`scripts/render.mjs` levanta un servidor estático, abre N páginas de Chromium headless (una por worker) y le asigna a cada una un bloque contiguo de frames. Para cada frame (o subframe, con `--mb`) llama a `window.__motion.seek(t)` y captura PNG por CDP. Cada worker manda los PNG a su propio ffmpeg, que promedia los subframes (`tmix`, eso es el motion blur) y escribe un segmento sin pérdida. Al final se concatenan los segmentos y se codifica una sola vez a H.264 BT.709 con techo de bitrate, grano y audio opcionales. El grano se genera a media resolución y se mezcla en overlay sobre la luma: se ve fílmico y comprime bien. El ruido pixel a pixel inflaba el archivo a ~117 Mbps.

## Estructura

```
lib/runtime.js     timeline maestro, seek determinístico, preview con scrubber y safe zones
lib/presets.js     animaciones reutilizables y curvas con nombre
lib/server.mjs     servidor estático (con byte ranges para <video>)
scripts/render.mjs render a MP4 / MOV / PNG
scripts/serve.mjs  preview en vivo
scripts/analyze.py análisis de videos de referencia
scripts/prep.py    talking head → transcripción, cortes, cara, frames, borrador del plan
scripts/asset.py   agrega imágenes / clips de B-roll a un proyecto
scripts/test-frames.sh  test de regresión: cada frame del MP4 = su tiempo exacto
lib/talk.js/.css   motor del editor de pantalla dividida
assets/sfx/        kit básico (make-sfx.sh) + assets/sfx/pro (sfxlib.py, kit profesional)
scripts/mix.mjs    stems de audio por composición + mux sobre videos ya renderizados (+ mixdown.py)
comps/             composiciones (una carpeta por video)
refs/ analysis/ out/   ignorados por git
```
