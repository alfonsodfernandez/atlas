# Cartografía de ATLAS

El globo usa Natural Earth Admin 0 – Countries en dos escalas: 1:110 millones
para el mapa inicial y 1:50 millones para el detalle que se solicita al acercar.
Las fuentes contienen 177 y 242 entidades cartográficas, respectivamente;
incluyen territorios y áreas disputadas, no una lista de países visitados.
Los límites reflejan el criterio de Natural Earth y siguen siendo generalizados.
Algunas islas pequeñas y enclaves quedan por debajo de la resolución del mapa.
[Conjunto de 110m](https://www.naturalearthdata.com/downloads/110m-cultural-vectors/110m-admin-0-countries/).
[Conjunto de 50m](https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-countries-2/).
[Condiciones de uso, dominio público](https://www.naturalearthdata.com/about/terms-of-use/).

Ambos GeoJSON están fijados al commit
`f1890d9f152c896d250a77557a5751a93d494776` del repositorio de Natural Earth.
La [fuente de 110m](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/f1890d9f152c896d250a77557a5751a93d494776/geojson/ne_110m_admin_0_countries.geojson)
tiene SHA-256
`6866c877d39cba9c357620878839b336d569f8c662d3cfab4cb1dbe2d39c977f`.
La [fuente de 50m](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/f1890d9f152c896d250a77557a5751a93d494776/geojson/ne_50m_admin_0_countries.geojson)
tiene SHA-256
`3e458fc036ad0a66411f2c1e6cac49c5d7bfb81cb1123bc513b22511a2b7fdeb`.

Las copias locales compactas conservan el orden de entidades, su campo
`ADM0_A3` y todos los anillos de cada polígono. Las coordenadas se redondean a
cuatro decimales y se guardan como enteros y diferencias entre puntos consecutivos.
Solo se utilizan para regenerar los PNG y quedan fuera de la web publicada.

- [Copia de 110m](../scripts/geo/ne-110m-countries.json), SHA-256
  `575780ac48578f66f4eefe661b6b7dd3ae1166c8e7e7984239a9835f0c261206`.
- [Copia de 50m](../scripts/geo/ne-50m-countries.json), SHA-256
  `4e7768a3f63f471573274f44acb48bf0e0cdccfa108adac79b8094690e03ace7`.

## Generación

El generador rasteriza los polígonos en una cuadrícula cuatro veces mayor en
cada eje. Obtiene las fronteras al comparar las celdas contiguas que pertenecen
a países distintos. Después promedia la cobertura en cada máscara.
El borde horizontal envuelve el antimeridiano. El polo sur conserva el relleno
antártico de la fuente.

Los PNG indexados tienen 64 entradas y 8 bits por píxel. Sus canales son
independientes: rojo para tierra, verde para fronteras interiores y azul para
resaltar la demostración. Cada canal usa los valores 0, 85, 170 y 255 para expresar
cobertura suavizada. La costa resulta de la transición de tierra a mar y sigue
visible aunque se desactive la capa de fronteras. WebGL decide los colores y
compone el mapa en una sola pasada; las imágenes no contienen relieve ni colores
de una fotografía satélite.

La máscara azul marca únicamente `ESP`, `MEX` y `JPN`: España, México y Japón.
Es una demostración sintética de la interfaz, no el historial del propietario.

| Archivo                | Dimensiones | Fuente             | Bytes  | Uso                       |
| ---------------------- | ----------- | ------------------ | ------ | ------------------------- |
| `atlas-map.png`        | 1024 × 512  | Natural Earth 110m | 18.277 | Carga inicial             |
| `atlas-map-detail.png` | 2048 × 1024 | Natural Earth 50m  | 51.920 | Carga diferida al acercar |

La versión detallada conserva islas y trazados que no aparecen en el mapa
mundial de 110m. Su mayor resolución reduce la pixelación al acercar, pero sigue
siendo cartografía de visualización; no es una fuente para geocodificar visitas.

```sh
node scripts/prepare-map.mjs
node scripts/prepare-map.mjs --check
```

El segundo comando comprueba la reproducción de los dos PNG sin modificarlos.
La regeneración habitual es local y no hace peticiones de red. El script verifica
los hashes de las fuentes compactas antes de procesarlas.

- SHA-256 de `atlas-map.png`:
  `863f498ea926b7e36b23ff8cc2447d3f0ca967c6dc12eeea89c62de3e3cbb20e`.
- SHA-256 de `atlas-map-detail.png`:
  `84f028c911d4cbc81d3881fd85cb31654b51b8a5eea5b636a8c98b8508585830`.
