# Medidas de rendimiento de ATLAS

Comparación entre el build de `9ee8fbf` con Cesium/React/Motion y la reescritura
nativa de la rama `fase-1-webgl-nativo`, medida el 16 de noviembre de 2026.
Los JSON conservan los nombres de archivos compilados, las cantidades exactas y
la fecha del ensayo. El informe posterior identifica su contenido mediante los
hashes de los nombres de assets, antes de asignar el commit final.

## Tamaño de descarga

Los pesos de JavaScript suman los archivos `.js` emitidos en `dist/assets/`.
Gzip se calcula con `node:zlib`, sin mezclar bytes comprimidos y sin comprimir.

| Medida                            |  Anterior |  Nativo |
| --------------------------------- | --------: | ------: |
| JS de build sin comprimir, bytes  | 4.615.573 |  41.046 |
| JS de build con gzip, bytes       | 1.258.993 |  14.920 |
| CSS nativo con gzip, bytes        |         — |   4.011 |
| Imagen NASA, bytes                |   356.467 | 356.467 |
| Fronteras binarias nativas, bytes |         — | 215.296 |
| Estimación inicial nativa, bytes  |         — | 590.694 |

La reducción de JS bruto es del **99,1 %**. La estimación inicial suma JS y CSS
con gzip y los dos archivos de mapas en su tamaño original. No cuenta HTML ni
cabeceras; el tráfico real depende de la compresión y caché del servidor. El
build original publicaba unos 14 MB de archivos, incluidos assets de Cesium;
esa cantidad es distinta de la descarga inicial observada.

Los presupuestos que valida `npm run check:bundle` son:

- JavaScript bruto: 65.536 bytes (64 KiB).
- JavaScript con gzip: 24.576 bytes (24 KiB).
- Estimación inicial: 716.800 bytes (700 KiB).

Fuentes: [antes](before-bundle.json) y [después](after-bundle.json).

## Arranque

Se tomó **una muestra fría por versión**, en el mismo entorno y con el mismo
script. Chromium usa SwiftShader, viewport de 1280 × 850, densidad de píxeles 1,
movimiento reducido y recursos servidos localmente. No se impuso un perfil de
red o CPU ni se utilizó un teléfono físico.

| Medida observada                    |  Anterior |  Nativo |
| ----------------------------------- | --------: | ------: |
| Marcador de globo preparado, ms     |     3.110 |     247 |
| Marcador de fronteras, ms           |     3.406 |     292 |
| Solicitudes de subrecursos          |        24 |       5 |
| Subrecursos decodificados, bytes    | 8.312.969 | 627.383 |
| JS decodificado observado, bytes    | 5.636.762 |  41.046 |
| Tareas largas observadas            |         6 |       1 |
| Duración total de tareas largas, ms |       735 |     139 |

Los marcadores se leen de los atributos de estado de la aplicación. Miden su
inicialización y disponibilidad declarada, no el fin de toda la rasterización de
la GPU. `PerformanceResourceTiming` cuenta subrecursos y excluye la navegación
HTML; los bytes decodificados son distintos del tráfico comprimido. El JS
observado anterior incluye archivos auxiliares solicitados por Cesium, por eso
supera los `.js` de `dist/assets/` del cuadro de build.

Estas muestras permiten comparar el arranque en estas condiciones. No son una
medición de FPS, una distribución estadística ni una garantía de los mismos
tiempos en otros dispositivos. Las medidas en hardware objetivo se mantienen
como trabajo de la Fase 7.

Fuentes: [antes](before-runtime.json) y [después](after-runtime.json).

## Reproducir la medición nativa

```sh
npm ci
npm run build
npm run check:bundle -- --report docs/performance/after-bundle.json
npm run preview -- --port 4173 --strictPort
```

Con ese servidor abierto, en otra terminal:

```sh
npm run measure:runtime -- http://127.0.0.1:4173/atlas/ docs/performance/after-runtime.json
```

Ejecuta una versión cada vez para evitar competencia entre procesos de GPU y
conserva las mismas condiciones al comparar. La revisión antigua se puede abrir
en un checkout separado de `9ee8fbf`; el script de medición admite sus mismos
marcadores. Guarda el SHA de origen al publicar una comparación nueva y actualiza
las tablas si cambian los informes.
