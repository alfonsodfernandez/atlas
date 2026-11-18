# ATLAS

Un atlas personal para recorrer, en un globo terráqueo 3D, los lugares que has
visitado. El proyecto se construye por fases a partir de exportaciones de Google
Maps Timeline, con el tratamiento de datos en tu propio ordenador.

ATLAS muestra un globo político sencillo con WebGL 2, TypeScript y CSS. Los
continentes y las fronteras proceden de Natural Earth a escala mundial. El mapa
usa tonos neutros y trazos simples. La importación de Timeline y los datos de
viajes llegarán en fases posteriores.

La hoja de ruta y las instrucciones de desarrollo están en [PLAN.md](PLAN.md)
y [AGENTS.md](AGENTS.md).

![Globo en escala de grises con fronteras simplificadas](docs/images/globo-cartografico.png)

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
a la vista inicial, inclinar la cámara y activar o desactivar las fronteras.

El área del globo también se puede enfocar con Tab: las flechas mueven la cámara,
`+` y `−` controlan el zoom, y `Home` recupera la vista inicial. Puedes activar
la rotación con su botón. Se detiene al interactuar y respeta la preferencia de
movimiento reducido. La ayuda, la privacidad y la hoja de ruta se pueden
consultar con teclado. Si el
navegador no puede mostrar WebGL, queda disponible una vista accesible y la
opción de reintentar.

El motor proyecta una máscara cartográfica local sobre el globo. Sus costas y
límites políticos son aproximados, procedentes del conjunto Natural Earth
1:110m fijado en el repositorio. La máscara solo sirve para dibujar; no debe
usarse para determinar el país de una visita junto a una frontera o en el mar.
[Procedencia, licencia y generación](docs/cartografia.md).

## Rendimiento

La escena del globo se resuelve en una llamada WebGL por fotograma. La máscara
de tierra y fronteras se genera de antemano y se distribuye como un PNG local.
El navegador no descarga ni procesa los polígonos de Natural Earth durante la
navegación. La geometría y los recursos de GPU se reutilizan y la escena se
dibuja cuando cambia; la animación se pausa cuando el visor no está visible.

El build controla presupuestos de **40 KiB de JavaScript sin comprimir, 15 KiB
con gzip y 44 KiB para la estimación conjunta de JS/CSS con gzip y el mapa**.
La descarga inicial estimada de esta revisión es de **32.757 bytes**.
[Informes y método de comparación](docs/performance/README.md).

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
public/maps/              Máscara cartográfica local para dibujar el globo
docs/performance/         Informes de tamaño y arranque
.github/workflows/        CI y publicación
```

Para generar o comprobar la máscara cartográfica:

```sh
node scripts/prepare-map.mjs
node scripts/prepare-map.mjs --check
```

La compilación usa `public/maps/atlas-map.png`. Los polígonos fuente se guardan
bajo `scripts/geo/` y quedan fuera del sitio publicado. La generación utiliza
la fuente local fijada y no necesita descargarla de nuevo.

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
