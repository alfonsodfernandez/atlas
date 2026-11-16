# Cartografía pública de ATLAS

Estos archivos contienen cartografía general del planeta, sin historial ni
ubicaciones personales. Se versionan para que el globo básico cargue sin claves
API ni peticiones a proveedores de mapas externos.

## Países y territorios

`countries.geojson` procede de **Natural Earth Admin 0 – Countries, 1:50m,
versión 5.1.2**. La colección contiene 242 entidades geográficas, incluidos
territorios y áreas disputadas; esa cifra no equivale al número de países
reconocidos ni representa países visitados.

- [Página oficial del dataset](https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-countries-2/).
- [Fuente GeoJSON fijada a un commit](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/f1890d9f152c896d250a77557a5751a93d494776/geojson/ne_50m_admin_0_countries.geojson).
- [Condiciones de uso de Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/): dominio público, permite modificación y redistribución.
- Crédito mostrado: **Natural Earth**.

ATLAS conserva los identificadores de Natural Earth, nombres en español e inglés,
continente y códigos ISO disponibles. Los códigos que faltan en la fuente se
representan con `null`; no se inventa una equivalencia. Los límites siguen la
cartografía de facto de Natural Earth, sin adoptar una posición sobre soberanía.

La geometría de visualización usa Douglas–Peucker con tolerancia de 0,02 grados
y redondeo a cuatro decimales. Se conservan los anillos de islas pequeñas cuando
la simplificación los haría degenerados. El archivo pasa de 99.613 a 52.186
vértices, manteniendo sus 242 entidades y 1.632 anillos cerrados.

Este archivo es **solo para dibujar la capa del globo**. La futura geocodificación
offline debe emplear geometrías e índices apropiados, sin reutilizar estas
fronteras simplificadas para decidir visitas cerca de una frontera.

## Textura terrestre

`earth.jpg` es el JPEG original, sin modificar, de **Blue Marble Next Generation
sin nubes**. Su proyección equirectangular está preparada para envolver una esfera.
Mide 2.048 × 1.024 píxeles y ocupa 356.467 bytes.

- [Página de NASA Scientific Visualization Studio](https://svs.gsfc.nasa.gov/3615/).
- [JPEG original de NASA](https://svs.gsfc.nasa.gov/vis/a000000/a003600/a003615/earth_noClouds.0330.jpg).
- [Condiciones de NASA SVS](https://svs.gsfc.nasa.gov/help/): sus materiales son de dominio público salvo aviso específico; la página de esta imagen no indica una excepción.
- Crédito: **NASA/Goddard Scientific Visualization Studio; Reto Stockli
  (NASA/GSFC), Blue Marble Next Generation / Earth Observatory**.

La textura es una composición histórica de 2004, sin nubes, con iluminación
simulada por Cesium. No es una imagen en directo ni un mapa de visitas.

## Regenerar y verificar

Desde la raíz del repositorio, tras instalar las dependencias:

```sh
npm ci
node scripts/prepare-maps.mjs
```

El script descarga exclusivamente las dos fuentes públicas, respeta las variables
de proxy del entorno y verifica sus sumas SHA-256 antes de escribir los archivos.
No lee exportaciones de Timeline ni configuración personal. La compilación normal
usa los assets ya versionados y no necesita descargarlos otra vez.

La procedencia estructurada, fecha de consulta, dimensiones y hashes están en
[`sources.json`](sources.json). Fuentes consultadas el **15 de noviembre de 2026**.

| Archivo                           | SHA-256                                                            |
| --------------------------------- | ------------------------------------------------------------------ |
| Natural Earth original            | `3e458fc036ad0a66411f2c1e6cac49c5d7bfb81cb1123bc513b22511a2b7fdeb` |
| `countries.geojson` generado      | `7a6c1045acb8ca9c49ae3bb19ef7376f0e4925f6d066420330d0462168fe52ba` |
| `earth.jpg` original y versionado | `1ed70af0494a92b69a40e12feffd7b47ad4c92b3d70ad0987fee77212b51635c` |
