# Cartografía de ATLAS

El globo usa Natural Earth Admin 0 – Countries, escala 1:110 millones,
versión 5.1.2. Sus 177 entidades cartográficas se representan con costas y
fronteras simplificadas. Los límites reflejan el criterio de Natural Earth
y el nivel de detalle de un mapa mundial. Algunas islas pequeñas y enclaves
quedan por debajo de la resolución del mapa.
[Conjunto de datos](https://www.naturalearthdata.com/downloads/110m-cultural-vectors/110m-admin-0-countries/).
[Condiciones de uso, dominio público](https://www.naturalearthdata.com/about/terms-of-use/).

La [fuente GeoJSON](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/f1890d9f152c896d250a77557a5751a93d494776/geojson/ne_110m_admin_0_countries.geojson)
tiene SHA-256
`6866c877d39cba9c357620878839b336d569f8c662d3cfab4cb1dbe2d39c977f`.
La [copia compacta](../scripts/geo/ne-110m-countries.json) conserva el orden de
entidades, su campo `ADM0_A3` y los anillos de cada polígono. Las coordenadas
se redondean a cuatro decimales y se guardan como enteros, con las diferencias
entre puntos consecutivos dentro de cada anillo. La copia tiene SHA-256
`575780ac48578f66f4eefe661b6b7dd3ae1166c8e7e7984239a9835f0c261206`.

## Generación

El generador rasteriza los polígonos en una cuadrícula cuatro veces mayor en
cada eje. Obtiene las fronteras al comparar las celdas contiguas que pertenecen
a países distintos. Después promedia la cobertura en una máscara de 1024 × 512.
El borde horizontal envuelve el antimeridiano. El polo sur conserva el relleno
antártico de la fuente.

El PNG indexado tiene 16 entradas. El canal rojo guarda la cobertura de tierra
y el verde la cobertura de frontera. La costa resulta de la transición entre
tierra y mar. WebGL aplica los tonos y el contorno en una sola pasada. El
navegador descarga únicamente la máscara de 17.081 bytes. La fuente vectorial
se utiliza en la generación local y queda fuera del sitio publicado.

```sh
node scripts/prepare-map.mjs
node scripts/prepare-map.mjs --check
```

El segundo comando comprueba la reproducción sin modificar el archivo.
SHA-256 del PNG
`b4ddd05ca8104caad6f1dcbf7125e78d36f4145538dae93b535bcbb72c970efa`.
