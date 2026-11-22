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

El generador rasteriza los polígonos en una cuadrícula doble (`2×`) en cada eje,
identifica las fronteras interiores comparando celdas contiguas de países
distintos y calcula campos de distancia euclídea (SDF para tierra y demostración,
y campo de distancia sin signo para fronteras) con envoltura horizontal en el
antimeridiano (±180°). El polo sur conserva el relleno antártico de la fuente.

Los PNG indexados usan hasta 256 entradas y 8 bits por píxel con canales
independientes: rojo para el SDF de tierra, verde para la distancia a fronteras
interiores y azul para el SDF de los países de ejemplo (acotado al SDF de tierra
para alinear costas y relleno sin escalonamiento). En el shader de fragmentos de
WebGL 2, la reconstrucción analítica con `fwidth()` dibuja costas, fronteras,
retícula sutil y el relleno terracota nítidos a cualquier nivel de zoom en una
sola pasada.

La máscara azul marca únicamente `ESP`, `MEX` y `JPN`: España, México y Japón.
Es una demostración sintética de la interfaz, no el historial del propietario.

| Archivo                | Dimensiones | Fuente             | Bytes  | Uso                       |
| ---------------------- | ----------- | ------------------ | ------ | ------------------------- |
| `atlas-map.png`        | 1024 × 512  | Natural Earth 110m | 22.909 | Carga inicial             |
| `atlas-map-detail.png` | 2048 × 1024 | Natural Earth 50m  | 65.459 | Carga diferida al acercar |

La versión detallada conserva islas y trazados que no aparecen en el mapa
mundial de 110m. Su mayor resolución y los campos de distancia mantienen costas,
fronteras y relleno nítidos al acercar, pero sigue siendo cartografía de
visualización; no es una fuente para geocodificar visitas.

```sh
node scripts/prepare-map.mjs
node scripts/prepare-map.mjs --check
```

El segundo comando comprueba la reproducción de los dos PNG sin modificarlos.
La regeneración habitual es local y no hace peticiones de red. El script verifica
los hashes de las fuentes compactas antes de procesarlas.

- SHA-256 de `atlas-map.png`:
  `a57e18ece9400f89dcd442753de73ce018107ee158bc6cddb012d808ec98972f`.
- SHA-256 de `atlas-map-detail.png`:
  `fae616c491b5e2a6fe65b5f17166a0bec64f605141e87cd863c0f9b6140dc2c3`.
