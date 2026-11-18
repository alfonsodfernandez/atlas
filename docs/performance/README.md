# Rendimiento de ATLAS

## Globo cartográfico

La comparación del 18 de noviembre de 2026 toma como referencia la Tierra
ilustrada publicada en `56776d9`. El nuevo globo dibuja los límites de Natural
Earth con una máscara local de dos canales y una sola llamada WebGL.

| Medida                              | Tierra ilustrada | Globo cartográfico |
| ----------------------------------- | ---------------: | -----------------: |
| Descarga inicial estimada, bytes    |           48.006 |             32.757 |
| Subrecursos decodificados, bytes    |           81.262 |             63.136 |
| Subrecursos solicitados             |                3 |                  3 |
| JavaScript de build, bytes          |           36.014 |             32.389 |
| JavaScript de build con gzip, bytes |           13.257 |             12.088 |
| Imagen o máscara, bytes             |           30.768 |             17.081 |
| Llamadas de dibujo por fotograma    |                2 |                  1 |
| Mediana hasta el primer dibujo, ms  |              126 |                106 |

La descarga inicial estimada baja un **32 %**. Suma JavaScript y CSS con gzip
más el tamaño de la máscara y excluye HTML y cabeceras. El límite que aplica el
build es de 44 KiB para esa estimación, 40 KiB de JavaScript bruto y 15 KiB de
JavaScript con gzip. [Informe de compilación](cartographic-bundle.json).

Se alternaron cinco arranques fríos por versión con Chromium y SwiftShader,
servidor local, 1280 × 850 a densidad 1 y movimiento reducido. En otra prueba de
dos segundos con el movimiento normal y los controles intactos, la versión
anterior promedió 54 llamadas de dibujo por segundo y la actual hizo cero.
La actual deja la rotación apagada al abrir. Los tiempos corresponden a estas
muestras en un entorno con GPU emulada. [Todas las muestras](cartographic-runtime.json).

## Tierra original

La comparación del 17 de noviembre de 2026 toma como referencia `ffebdb5`,
la primera versión WebGL nativa publicada. Compara el mismo visor con los
contornos originales, el PNG indexado y el motor simplificado.

| Medida                                | WebGL anterior | Tierra original |
| ------------------------------------- | -------------: | --------------: |
| Descarga inicial estimada, bytes      |        590.694 |          48.006 |
| Subrecursos decodificados, bytes      |        627.383 |          81.262 |
| Subrecursos solicitados               |              5 |               3 |
| JavaScript de build, bytes            |         41.046 |          36.014 |
| JavaScript de build con gzip, bytes   |         14.920 |          13.257 |
| Cartografía descargada, bytes         |        571.763 |          30.768 |
| Llamadas de dibujo por fotograma      |              4 |               2 |
| Triángulos de la superficie terrestre |          9.216 |           4.096 |
| Mediana hasta el primer dibujo, ms    |            232 |             130 |

La descarga inicial estimada se reduce un **92 %**. La estimación suma
JavaScript y CSS con gzip más el tamaño de los mapas y excluye HTML y cabeceras.
El tráfico real depende de la compresión y la caché del servidor. El límite de
compilación es de 64 KiB para esa estimación, 48 KiB para JavaScript bruto y
20 KiB para JavaScript con gzip. [Informe de compilación](original-bundle.json).

El navegador se inició desde cero para cada una de tres muestras por versión,
alternadas en el mismo entorno. Se sirvieron los builds estáticos en local y se
usó Chromium con SwiftShader, una ventana de 1280 × 850 a densidad 1 y movimiento
reducido. Los tiempos fueron 494, 232 y 216 ms para la versión anterior y 182,
130 y 99 ms para la Tierra original. El marcador registra cuándo la aplicación
envía el primer dibujo con la Tierra cargada a WebGL. `PerformanceResourceTiming` excluye la página
HTML del recuento de subrecursos. Los resultados corresponden a estas muestras
locales con GPU emulada. [Todas las muestras](original-runtime.json).

## Reproducir la medición

```sh
npm ci
npx playwright install chromium
npm run build
npm run check:bundle -- --report /tmp/atlas-bundle.json
npm run preview -- --port 4173 --strictPort
```

Con el servidor abierto, ejecuta este comando en otra terminal.

```sh
npm run measure:runtime -- http://127.0.0.1:4173/atlas/ /tmp/atlas-runtime.json
```

Para comparar, compila también `56776d9` en un checkout separado y usa el
mismo script de medición con los dos builds. Alterna las versiones y ejecuta
un solo navegador a la vez para reducir la competencia por CPU y GPU.

## Migración de Cesium a WebGL nativo

El 16 de noviembre de 2026 se comparó el build de Cesium, React y Motion
(`9ee8fbf`) con la primera versión WebGL nativa. El JavaScript de build pasó
de 4.615.573 a 41.046 bytes. En una muestra fría por versión, el arranque
pasó de 3.110 a 247 ms y los subrecursos decodificados de 8.312.969 a 627.383
bytes. Las dos muestras se tomaron con Chromium y SwiftShader en local.
[Build de Cesium](before-bundle.json), [build WebGL](after-bundle.json),
[arranque de Cesium](before-runtime.json) y [arranque WebGL](after-runtime.json).
