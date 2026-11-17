# Atlas Earth — ilustración original

`atlas-earth.png` es una ilustración del planeta creada para ATLAS mediante código.
No utiliza imágenes, cartografía, datos GIS ni fronteras de proveedores externos.
Los contornos aproximados de continentes e islas se han trazado a mano con puntos
de control en [`earth-shapes.mjs`](../../scripts/earth-shapes.mjs).

El generador rasteriza esos polígonos, resuelve el cruce del antimeridiano y añade
mares turquesa, terreno verde y ocre, cordilleras curvas y nieve polar. Los
colores y el relieve pictórico proceden de ruido coherente con semillas fijas y
de fórmulas originales; no representan altitudes ni límites oficiales. Es una
geografía reconocible e ilustrativa, no una fuente para geocodificar lugares.

- Proyección equirectangular: norte en la primera fila, oeste a la izquierda.
- Dimensiones: **1024 × 512 píxeles**, completamente opaco.
- PNG indexado de **64 colores** y **30.768 bytes**.
- Codificador PNG propio con paleta explícita, CRC-32 y compresión `zlib`.
- SHA-256: `628097ba51fbe768e31136b53e0ec024533866251e34d522194f8c2b5d803588`.

Desde la raíz del repositorio:

```sh
node scripts/prepare-earth.mjs
node scripts/prepare-earth.mjs --check
```

El primer comando regenera el PNG; el segundo comprueba que coincide byte a byte
sin modificarlo. Solo se usan módulos integrados de Node.js y el archivo de
contornos del proyecto. No se descarga ningún recurso ni se leen datos personales.
Las pruebas verifican la estructura PNG, los CRC, la paleta, el tamaño, la
orientación y muestras interiores de continentes y océanos.
