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

Requiere Node 18+, ffmpeg y, para el analizador, Python 3 con `numpy` y `Pillow`.

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
comps/             composiciones (una carpeta por video)
refs/ analysis/ out/   ignorados por git
```
