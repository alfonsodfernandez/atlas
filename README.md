# ATLAS

Un atlas personal para recorrer, en un globo terráqueo 3D, los lugares que has
visitado. El proyecto se construye por fases a partir de exportaciones de Google
Maps Timeline, con el tratamiento de datos en tu propio ordenador.

**Estado: Fase 0 — andamiaje.** Esta versión prepara la aplicación, las
comprobaciones de calidad y las barreras de privacidad. La pantalla inicial
permite consultar la hoja de ruta y la política de privacidad. El motivo orbital
es una ilustración: Cesium, el historial, las estadísticas y la importación de
datos se incorporarán en las siguientes fases. No contiene viajes personales.

La hoja de ruta completa está en [PLAN.md](PLAN.md); las instrucciones técnicas
para continuar el desarrollo, en [AGENTS.md](AGENTS.md).

![Pantalla inicial de ATLAS en Fase 0](docs/images/fase-0.png)

## Arrancar en local

Necesitas **Node.js 24 LTS**, **npm 11** y Git.

```sh
git clone https://github.com/alfonsodfernandez/atlas.git
cd atlas
npm ci
npm run dev
```

Abre [http://localhost:5173/atlas/](http://localhost:5173/atlas/). No necesitas
cuentas de mapas, claves API ni datos de Timeline para esta fase.

```sh
npm run check       # privacidad, formato, lint, tipos y pruebas unitarias
npm run build       # aplicación estática en apps/web/dist/
npm run preview     # previsualizar el build
```

Las pruebas de navegador usan Chromium:

```sh
npx playwright install chromium
npm run test:e2e
```

GitHub Actions ejecuta las comprobaciones de la Fase 0 en cada push y pull
request. Los E2E actuales comprueban la pantalla inicial; los del globo se
añadirán cuando exista esa funcionalidad.

## Privacidad

**Las exportaciones crudas nunca deben subirse al repositorio, a un chat ni a un
servidor.** El historial puede revelar tu casa, tu trabajo y tus rutinas. Guarda
los originales únicamente en tu equipo, dentro de `data/raw/`, que Git ignora.

Desde el primer commit se ignoran también `Timeline.json`, `*.Timeline.json`,
`location-history.json`, `Records.json`, las carpetas `Semantic Location History/`
y `Takeout/`, los ZIP de `data/`, el archivo local `atlas.config.json` y las
variables de entorno privadas.

Husky instala un hook de pre-commit al ejecutar `npm ci`. Este comprueba el
contenido preparado en el índice de Git; CI vuelve a comprobar el árbol del
repositorio. Los controles buscan nombres de exportación y firmas del formato
crudo, y bloquean el commit si los detectan. Puedes ejecutarlos con
`npm run check:privacy`. No fuerces la inclusión de archivos ignorados ni
desactives el hook.

Estas barreras evitan errores comunes, pero **no convierten cualquier JSON en
datos publicables**. El pipeline de saneado aún no está implementado. No añadas
historial real a `public/`: todo lo que contenga esa carpeta formará parte del
build público.

El contrato previsto para la Fase 2 es publicar únicamente
`public/data/atlas.json`, validado y agregado:

- Precisión de ciudad por defecto; una ubicación exacta requerirá marcar ese
  lugar como público de forma explícita.
- Zonas de exclusión para casa, trabajo y otros lugares privados. Se eliminarán
  o reducirán a municipio según la configuración elegida.
- Fechas sin horas exactas, con opción de conservar solo mes o año.
- Sin trazas GPS detalladas junto a zonas excluidas.
- Avisos locales sobre posibles ubicaciones de casa y trabajo y un informe de lo
  que se publicaría antes de guardar el resultado.

## Cargar tus datos

**Pendiente de las Fases 2 y 5.** Por ahora no existe el comando `ingest` ni un
formulario de importación. No hace falta exportar tu historial para arrancar la
aplicación.

El flujo previsto será:

1. Exportar Timeline desde Android, iOS o Google Takeout, siguiendo las
   instrucciones que se verificarán y documentarán al implementar los parsers.
2. Guardar el JSON o ZIP en `data/raw/` en tu ordenador.
3. Copiar `atlas.config.example.json` a `atlas.config.json` y definir las zonas
   que quieres excluir. El ejemplo actual es una propuesta de configuración y
   todavía no se aplica ni se valida.
4. Ejecutar la futura CLI local `npm run ingest -- data/raw/Timeline.json` y
   revisar su informe de privacidad.
5. Revisar y versionar únicamente el `public/data/atlas.json` saneado.

La alternativa prevista para la Fase 5 procesará JSON o ZIP en un Web Worker del
navegador y permitirá descargar el resultado saneado sin enviar el archivo a un
servidor. El desarrollo usará exclusivamente muestras sintéticas identificadas
como tales; nunca se presentarán como el historial de Alfonso.

## Estructura

```text
apps/web/                 Aplicación React + Vite + TypeScript
packages/timeline-parser/ Lógica compartida para CLI y futuro Web Worker
packages/geo/             Base para geocodificación offline
scripts/                  Comprobaciones y futura CLI
data/sample/              Documentación del futuro dataset sintético
data/raw/                 Exportaciones locales, ignoradas por Git
public/data/              Futura salida agregada y saneada
.github/workflows/        Integración continua
```

## Desplegar

El destino elegido es **GitHub Pages**, con la base de Vite `/atlas/`. La
publicación automática y la comprobación del globo desplegado pertenecen a la
Fase 1; la Fase 0 no tiene una URL pública operativa.

En la Fase 1 se añadirá `.github/workflows/deploy.yml` para publicar desde `main`.
En GitHub habrá que elegir **Settings → Pages → Build and deployment → Source:
GitHub Actions**. El repositorio es privado: la disponibilidad de Pages depende
del plan y de las políticas de la cuenta; no se cambiará su visibilidad de forma
automática.

Para un **dominio propio o subdominio**, compila con
`ATLAS_BASE_PATH=/ npm run build`, añade `public/CNAME` con tu dominio antes del
build y configura los registros DNS
según GitHub Pages. Comprueba HTTPS antes de compartir el enlace.

Para un **VPS con Nginx**, ejecuta `npm ci && npm run build` y copia el contenido
de `apps/web/dist/` al directorio que sirva Nginx. Con la base actual, el build
debe servirse bajo `/atlas/`, por ejemplo desde `/var/www/html/atlas/`:

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

Adapta el dominio y habilita TLS en tu servidor. Para servir en la raíz del
dominio, cambia la base a `/`, recompila y ajusta el directorio y la ruta de
Nginx. Sube únicamente el build; no copies el repositorio completo ni `data/raw/`.

Los tokens opcionales de Cesium ion y Google Maps se conectarán en la Fase 1.
Las variables de Vite son visibles en el navegador: las claves de mapas deben
restringirse al dominio y a las APIs necesarias. La versión básica funcionará
con imágenes sin clave y atribución a sus proveedores.

## Próximo hito

La Fase 1 integrará Cesium con un globo WGS84, imágenes sin clave, atmósfera,
iluminación día/noche, controles y capa de países Natural Earth. Después se
investigarán los formatos actuales de Timeline antes de escribir los parsers.
