# Carrusel FYG × Meta — guía de sonido y mezcla

## Qué hay en el paquete

| Carpeta | Contenido | Para qué |
|---|---|---|
| `con-sonido/` | 9 slides + versión completa con los efectos ya pegados | Publicar directo, o como base en tu editor |
| `sin-sonido/` | Los mismos videos sin audio | Si querés armar el sonido desde cero |
| `stems/` | Efectos solos en WAV (48 kHz, 24 bit), uno por slide + completo, alineados al cuadro 0 | Balancear contra tu música en CapCut / Premiere / Resolve |
| `stems/*-cues.csv` | Hoja de cues: cada sonido con su segundo exacto y ganancia | Saber qué suena dónde, o reemplazar algún efecto |

No hay música: la elegís vos.

## Niveles de partida

- **Efectos (como vienen):** picos de corto plazo en ~-21 LUFS en todas las slides (parejo entre slides), picos máximos entre -4 y -10 dBFS. Dejé margen a propósito para que entre tu música.
- **Música:** arrancá con la música entre **12 y 16 dB por debajo de su volumen original** (en CapCut ≈ 20–30 %). Regla práctica: en los golpes (el "chat" de la slide 1, la notificación de la slide 8, los toggles de la 6) el efecto tiene que escucharse claro por encima de la música; en el resto, la música lleva la energía.
- **Exportación final:** apuntá a **-14 LUFS integrado y picos ≤ -1 dBTP** (el estándar de facto para Reels; Instagram baja lo que venga más fuerte).
- **Opcional (ducking):** bajá la música 3–4 dB durante 1 segundo en el impacto de la slide 1 y en la notificación de la slide 8.

## Instagram: ojo con la música del carrusel

Según reportes de creadores (Instagram no lo documenta), **si agregás música desde la app a un carrusel con videos, el audio de los videos se silencia**: perderías los efectos. Opciones:

1. **Mezclar afuera (recomendado):** en CapCut, cada slide = video `sin-sonido` + su stem de efectos + tu música recortada a esa slide. Exportás las 9 y las subís como carrusel sin agregar música en la app.
2. **Música de la app sin efectos:** subís los videos y elegís música en Instagram. Simple, pero sin diseño sonoro.
3. **Reel con la versión completa:** el editor de Reels permite subir la música y bajar/subir el audio original por separado.

## Qué música elegir

- **Estilo:** electrónica minimal / corporativa limpia, **100–125 BPM**, sin voces: una letra compite con el texto que la gente está leyendo.
- **Licencia:** para anuncios en Meta, la **Meta Sound Collection** es gratis y está licenciada para Facebook e Instagram (solo para esas plataformas). Para usar el mismo video en otras redes, una librería paga (Epidemic Sound, Artlist). Evitá música comercial con copyright en anuncios.
- Los efectos son 100 % propios (sintetizados), no tienen licencia ni reclamos posibles.

## Probar antes de publicar

- Escuchá en el **parlante del celular** (es mono): los efectos están verificados para no cancelarse en mono.
- Escuchá con auriculares: los mensajes enviados suenan levemente a la derecha y los recibidos a la izquierda, como en pantalla.

## Si querés cambios

Más o menos efectos, otro volumen por tipo de sonido (por ejemplo, teclas más suaves) o reemplazar un sonido: se remezcla en segundos, sin volver a renderizar los videos.
