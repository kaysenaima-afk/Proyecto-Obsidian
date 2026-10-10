# Carrusel FYG × Meta: guía de sonido y mezcla (v2)

## Qué cambió respecto de la primera versión

La v1 usaba sonidos sintetizados: bien sincronizados, pero sonaban a "bip" de computadora. La v2 está hecha con **foley real** (tomas grabadas generadas con ElevenLabs) y editada como en un estudio:

- **Material real:** whooshes de aire, teclas mecánicas de verdad (9 pulsaciones distintas), candados metálicos, switches de plástico, marcador sobre papel, toques en el vidrio del celular, campanitas y marimba.
- **Sincronía al golpe:** cada sonido cae con su punto fuerte (el clic, el snap, el pico del whoosh) en el cuadro exacto de la animación, no con el inicio del archivo.
- **Jerarquía medida en LUFS:** golpes protagonistas > acciones > movimiento > textura. Variaciones de una misma familia suenan igual de fuertes.
- **Impacto en capas:** boom grave + golpe con "crack", para que la portada pegue también en el parlante del celular.
- **Detalles de estudio:** "alguien está escribiendo" mientras rebotan los tres puntitos, checks que suben un tono cada uno, estéreo que sigue la posición de cada elemento, y una sala corta compartida para que todo suene en el mismo espacio.
- **Más presencia:** picos en -1 dBFS (antes entre -4 y -10).

## Qué hay en el paquete

| Carpeta | Contenido | Para qué |
|---|---|---|
| `con-sonido/` | 9 slides + versión completa con los efectos pegados | Publicar directo, o como base en tu editor |
| `sin-sonido/` | Los mismos videos sin audio | Armar el sonido desde cero |
| `stems/` | Efectos solos en WAV (48 kHz, 24 bit), uno por slide + completo, alineados al cuadro 0 | Balancear contra tu música en CapCut / Premiere / Resolve |
| `stems/*-cues.csv` | Hoja de cues: cada sonido con el segundo en que arranca, el segundo en que pega (`golpe_s`) y su ganancia | Saber qué suena dónde, o reemplazar un efecto |

No hay música: la elegís vos.

## Niveles de partida

- **Efectos (como vienen):** picos en -1 dBFS; entre -19 y -23 LUFS de corto plazo según la slide. Las slides con muchos clics (3 y 6) miden menos LUFS pero suenan con punch: están así a propósito.
- **Música:** arrancá con los efectos al 100 % y la música **8–10 dB por debajo de su volumen original** (en CapCut ≈ 30–40 %). Regla práctica: en los golpes (el impacto de la portada, los toggles de la 6, la notificación de la 8) el efecto tiene que escucharse claro por encima de la música; en el resto, la música lleva la energía. Si los efectos te parecen mucho, bajalos al 70–80 % antes de tocar la música.
- **Exportación final:** apuntá a **-14 LUFS integrado y picos ≤ -1 dBTP** (estándar de facto para Reels; Instagram baja lo que venga más fuerte).
- **Opcional (ducking):** bajá la música 3–4 dB durante 1 segundo en el impacto de la slide 1 y en la notificación de la slide 8.

## Instagram: ojo con la música del carrusel

Según reportes de creadores (Instagram no lo documenta), **si agregás música desde la app a un carrusel con videos, el audio de los videos se silencia**: perderías los efectos. Opciones:

1. **Mezclar afuera (recomendado):** en CapCut, cada slide = video `sin-sonido` + su stem de efectos + tu música recortada a esa slide. Exportás las 9 y las subís como carrusel sin agregar música en la app.
2. **Música de la app sin efectos:** subís los videos y elegís música en Instagram. Simple, pero sin diseño sonoro.
3. **Reel con la versión completa:** el editor de Reels permite subir la música y bajar/subir el audio original por separado.

## Qué música elegir

- **Estilo:** electrónica minimal / corporativa limpia, **100–125 BPM**, sin voces: una letra compite con el texto que la gente está leyendo.
- **Licencia:** para anuncios en Meta, la **Meta Sound Collection** es gratis y está licenciada para Facebook e Instagram (solo para esas plataformas). Para usar el mismo video en otras redes, una librería paga (Epidemic Sound, Artlist). Evitá música comercial con copyright en anuncios.
- **Licencia de los efectos:** se generaron con ElevenLabs desde tu cuenta. Con plan pago se usan comercialmente sin atribución; en plan gratuito ElevenLabs pide atribución. Revisá qué plan tenés antes de pautar.

## Probar antes de publicar

- Escuchá en el **parlante del celular** (es mono): todo está verificado para no cancelarse en mono (pérdida ≤ 0,6 dB).
- Escuchá con auriculares: los mensajes enviados suenan a la derecha, los recibidos a la izquierda y cada tarjeta desde donde aparece.

## Si querés cambios

Más o menos efectos, otro volumen por tipo de sonido (por ejemplo, teclas más suaves), menos sala o reemplazar un sonido: se remezcla en segundos, sin volver a renderizar los videos.
