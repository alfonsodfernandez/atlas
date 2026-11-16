# ATLAS

Un atlas personal para recorrer, en un globo terráqueo 3D, los lugares que has
visitado. El proyecto se construye por fases a partir de exportaciones de Google
Maps Timeline, con el tratamiento de datos en tu propio ordenador.

**Hito actual: reescritura del globo en WebGL nativo.** A petición del usuario,
la Tierra, sus shaders, cámara y controles se programan a mano. La interfaz usa
TypeScript y CSS, con acceso directo al DOM. Esta versión sustituye el motor y
los frameworks de la primera implementación para reducir la descarga y el
trabajo del navegador. La importación de Timeline llegará en la Fase 2; todavía
no hay visitas ni estadísticas personales.

La hoja de ruta está en [PLAN.md](PLAN.md) y las instrucciones para continuar el
desarrollo, en [AGENTS.md](AGENTS.md).

![Globo WebGL nativo con textura NASA y fronteras de Natural Earth](docs/images/webgl-nativo.png)

## Arrancar en local

Necesitas **Node.js 24 LTS**, **npm 11** y Git.

```sh
git clone https://github.com/alfonsodfernandez/atlas.git
cd atlas
npm ci
npm run dev
```

Abre [http://localhost:5173/atlas/](http://localhost:5173/atlas/). No necesitas
cuentas de mapas, claves API ni datos de Timeline.

```sh
npm run check       # privacidad, formato, lint, tipos y pruebas unitarias
npm run build       # build estático y comprobación del presupuesto de descarga
npm run preview     # servir apps/web/dist/
npm run check:bundle # volver a comprobar el tamaño del build
```

Las pruebas de navegador usan Chromium:

```sh
npx playwright install chromium
npm run test:e2e
```

GitHub Actions comprueba cada push y pull request. Los resultados del hito se
registran en [PLAN.md](PLAN.md); las medidas de rendimiento conservan su método
y revisión de origen en [docs/performance/](docs/performance/).

## Explorar el globo

Arrastra para girar la Tierra y usa la rueda o los controles de zoom para
acercarte. En móvil puedes usar los gestos táctiles. La interfaz permite volver
a la vista inicial, inclinar la cámara y activar o desactivar las fronteras y la
iluminación día/noche.

El área del globo también se puede enfocar con Tab: las flechas mueven la cámara,
`+` y `−` controlan el zoom, y `Home` recupera la vista inicial. La rotación lenta
se detiene al interactuar y respeta la preferencia de movimiento reducido. La
ayuda, la privacidad y la hoja de ruta se pueden consultar con teclado. Si el
navegador no puede mostrar WebGL, queda disponible una vista accesible y la
opción de reintentar.

La Tierra es un elipsoide WGS84 con textura NASA Blue Marble. Las fronteras
proceden de Natural Earth Admin 0, escala 1:50m. Ambos se sirven con la aplicación
y conservan sus atribuciones visibles. El modelo representa la superficie
terrestre sobre el elipsoide; su detalle procede de la textura local.

La [procedencia y las licencias de la cartografía](public/maps/README.md)
incluyen versiones y hashes. Las 242 entidades de Natural Earth incluyen
territorios y áreas disputadas; no son un contador de países visitados. El
formato binario de fronteras es solo para dibujar. La futura geocodificación
usará geometrías e índices adecuados para decidir países y ciudades.

## Rendimiento

El visor usa buffers de GPU y shaders GLSL propios. Las fronteras comparten un
lote de líneas en lugar de crear una entidad por cada polígono. La escena se
dibuja cuando cambia; la rotación se pausa al ocultar la pestaña o el visor. La
resolución de renderizado tiene un límite para controlar el trabajo en pantallas
con mucha densidad de píxeles.

El JavaScript de toda la página pasa de **4,6 MB a 41 KB sin comprimir**:
una reducción del **99,1 %** frente al build anterior. Estas son las cifras
exactas, con las mismas unidades en ambas versiones:

| Medida                          | Versión anterior | WebGL nativo |
| ------------------------------- | ---------------: | -----------: |
| JavaScript de build, bytes      |        4.615.573 |       41.046 |
| JavaScript con gzip, bytes      |        1.258.993 |       14.920 |
| Marcador de globo preparado, ms |            3.110 |          247 |
| Marcador de fronteras, ms       |            3.406 |          292 |
| Solicitudes de subrecursos      |               24 |            5 |

El arranque se midió una vez por versión, con navegador frío, Chromium y
SwiftShader, viewport 1280 × 850 a densidad 1, movimiento reducido y servidor
local. Es una comparación reproducible de inicialización, no una medición de FPS
ni una promesa de esos tiempos en todos los dispositivos. El método y los
informes originales están en [docs/performance/README.md](docs/performance/README.md).

El build nuevo cumple los presupuestos de **64 KiB de JS y 24 KiB con gzip**.
`npm run build` comprueba esos límites automáticamente. La imagen NASA ocupa
356.467 bytes y las fronteras binarias, 215.296 bytes; la suma estimada de
JS/CSS con gzip y ambos mapas es de 590.694 bytes, aproximadamente 591 KB.
La textura y el binario mantienen su tamaño original en esa estimación; no
incluye el documento HTML ni las cabeceras de la conexión.

La aplicación ya no utiliza los modos de Cesium ion ni Google 3D Tiles de la
implementación anterior. El motor propio y los recursos locales son la base de
esta revisión; las antiguas claves de mapas no intervienen en ella.

## Privacidad

**Las exportaciones crudas nunca deben subirse al repositorio, a un chat ni a un
servidor.** El historial puede revelar tu casa, tu trabajo y tus rutinas. Guarda
los originales únicamente en tu equipo, dentro de `data/raw/`, que Git ignora.

Desde el primer commit se ignoran también `Timeline.json`, `*.Timeline.json`,
`location-history.json`, `Records.json`, las carpetas `Semantic Location History/`
y `Takeout/`, los ZIP de `data/`, el archivo local `atlas.config.json` y las
variables de entorno privadas.

Husky instala un hook de pre-commit al ejecutar `npm ci`. Comprueba los blobs
preparados en el índice de Git; CI vuelve a comprobar el árbol del repositorio.
Los controles buscan nombres de exportación y firmas del formato crudo, y
bloquean el commit si los detectan. Puedes ejecutarlos con
`npm run check:privacy`. Mantén los archivos ignorados fuera del índice y el
hook activo.

Estas barreras evitan errores comunes, pero **no convierten cualquier JSON en
datos publicables**. El pipeline de saneado aún no está implementado. Todo lo
que contenga `public/` formará parte del build publicado.

El contrato previsto para la Fase 2 es publicar únicamente
`public/data/atlas.json`, validado y agregado:

- Precisión de ciudad por defecto; la ubicación exacta de un lugar requerirá
  marcarlo como público de forma explícita.
- Zonas de exclusión para casa, trabajo y otros lugares privados.
- Fechas sin horas exactas, con opción de conservar solo mes o año.
- Sin trazas GPS detalladas junto a zonas excluidas.
- Avisos locales sobre posibles ubicaciones de casa y trabajo y un informe de
  lo que se publicaría antes de guardar el resultado.

## Cargar tus datos

**Pendiente de las Fases 2 y 5.** Por ahora no existe el comando `ingest` ni un
formulario de importación. El flujo previsto será:

1. Exportar Timeline desde Android, iOS o Takeout con las instrucciones que se
   verificarán al implementar los parsers.
2. Guardar el JSON o ZIP en `data/raw/` en tu ordenador.
3. Copiar `atlas.config.example.json` a `atlas.config.json` y definir las zonas
   que quieres excluir. El ejemplo todavía es provisional.
4. Ejecutar la futura CLI `npm run ingest -- data/raw/Timeline.json` en local y
   revisar su informe de privacidad.
5. Revisar y versionar únicamente el `public/data/atlas.json` saneado.

La alternativa de la Fase 5 procesará JSON o ZIP en un Web Worker del navegador
y permitirá descargar el resultado saneado con procesamiento local. El
desarrollo utilizará exclusivamente muestras sintéticas identificadas como tales.

## Estructura

```text
apps/web/                 Interfaz TypeScript/CSS y motor WebGL propio
packages/timeline-parser/ Lógica futura para CLI y Web Worker
packages/geo/             Base para geocodificación offline
scripts/                  Calidad, generación de mapas y mediciones
data/sample/              Futuro dataset sintético
data/raw/                 Exportaciones locales, ignoradas por Git
public/data/              Futura salida agregada y saneada
public/maps/              Textura y fronteras públicas con procedencia
docs/performance/         Informes de tamaño y arranque
.github/workflows/        CI y publicación
```

Para reproducir la cartografía pública:

```sh
node scripts/prepare-maps.mjs
node scripts/prepare-borders.mjs
```

La compilación normal usa los archivos ya versionados y no vuelve a descargarlos.

## Desplegar

El destino es **GitHub Pages**. `.github/workflows/deploy.yml` publica la revisión
actual de `main` tras una CI correcta y también admite ejecución manual desde
`main`. Comprueba calidad y privacidad, prepara el build y sube únicamente
`apps/web/dist/`. La base local es `/atlas/`; la publicación utiliza la base
proporcionada por Pages.

La fuente de Pages debe ser **Settings → Pages → Build and deployment → Source:
GitHub Actions**. El usuario ya ha mostrado esa selección guardada. El estado
del despliegue y la URL pública se verifican por separado; consulta el registro
actual en [PLAN.md](PLAN.md). Para ejecutar la publicación, abre
[Publicar en GitHub Pages](https://github.com/alfonsodfernandez/atlas/actions/workflows/deploy.yml),
pulsa **Run workflow**, elige **main** y espera a que `build` y `deploy` terminen
en verde. El build nativo no requiere secrets de mapas.

Para un **dominio propio**, añade `public/CNAME` con tu dominio y compila con
`ATLAS_BASE_PATH=/ npm run build`. Configura los DNS según GitHub Pages y
comprueba HTTPS antes de compartir el enlace.

Para un **VPS con Nginx**, ejecuta `npm ci && npm run build` y copia el contenido
de `apps/web/dist/` al directorio servido. Con la base actual:

```nginx
server {
    listen 80;
    server_name atlas.example.com;
    root /var/www/html;

    location /atlas/ {
        try_files $uri $uri/ /atlas/index.html;
    }
}
```

Para servir en la raíz del dominio, compila con base `/` y adapta la ruta de
Nginx. Publica únicamente el build estático.

## Próximo hito

Tras validar esta reescritura y su publicación, la Fase 2 investigará los formatos
actuales de Timeline y construirá el pipeline de datos sintéticos, geocodificación
offline y saneado. Explorar el globo actual no requiere exportar tu historial.
