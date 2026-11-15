# ATLAS — instrucciones para agentes

## Alcance y fases

Lee `PLAN.md` antes de modificar el proyecto. Avanza en orden y deja cada fase
funcional. La Fase 0 está integrada en `main`; el hito actual es la Fase 1, con
Cesium y preparación de GitHub Pages. No implementes parsers sin investigar antes
los formatos actuales ni presentes datos ficticios como el historial de Alfonso.

## Arranque y comandos

- Node.js 24 LTS y npm 11; monorepo con npm workspaces.
- `npm ci`: instala exactamente el lockfile y configura Husky.
- `npm run dev`: SPA de Vite en `http://localhost:5173/atlas/`.
- `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test`.
- `npm run check:privacy`: examina los ficheros versionados y los nuevos no ignorados.
- `npm run check`: privacidad, formato, lint, tipos y pruebas unitarias.
- `npm run build`: genera `apps/web/dist/`; `npm run preview` sirve ese build.
- `npm run test:e2e`: Playwright (instalar Chromium con
  `npx playwright install chromium` una vez).
- Las claves opcionales se configuran en `.env.local` en la raíz a partir de
  `.env.example`; nunca son necesarias para el globo básico.
- `ATLAS_BASE_PATH=/ npm run build`: build para la raíz de un dominio. La base
  por defecto es `/atlas/`; la variable se pasa al proceso de Vite.

## Estructura y convenciones

- `apps/web/`: React + Vite + TypeScript strict, Tailwind, Zustand y Motion.
- `packages/timeline-parser/`: futura lógica isomórfica de importación; no usar
  APIs de Node aquí. Investiga formatos actuales antes de implementar parsers.
- `packages/geo/`: futura geocodificación offline; sin llamadas externas en runtime.
- `scripts/`: utilidades Node, comprobaciones y futura CLI.
- `public/data/`: únicamente salida agregada y saneada, cuando exista en Fase 2.
- UI y documentación para usuarios en español; textos centralizados para i18n.
- Mantén cambios pequeños, accesibilidad y `prefers-reduced-motion`.
- Prueba la lógica de datos y los límites de privacidad con Vitest. Reserva
  Playwright para flujos de usuario y el globo real; no sustituyas WebGL por un
  mock para afirmar que se ha renderizado. La selección de datos llega en Fase 3.

## Privacidad obligatoria

Los datos crudos se procesarán solo en el ordenador del usuario. Nunca solicites
ni incorpores sus exportaciones reales, coordenadas de casa, trabajo o rutinas.
`data/raw/`, `atlas.config.json` y los nombres de exportación están ignorados.
Nunca uses `git add -f` para incluirlos. No imprimas contenido sensible al fallar
un chequeo. El hook de pre-commit revisa el índice de Git; CI revisa el árbol.
Las muestras de formatos crudos se generarán en memoria o como fixtures de texto
inequívocamente sintéticas y acotadas, sin excluir carpetas enteras del control.
Documenta cualquier excepción explícita con su prueba. No desactives el hook para
terminar una fase.

## Git y despliegue

Ramas por fase (`fase-0-andamiaje`, `fase-1-globo`, etc.), commits convencionales
y merge a `main` únicamente con controles verdes. Nunca fuerces `main`.
El repositorio empieza vacío: un primer commit de privacidad inicializa `main`
antes de abrir la rama de fase. Actualiza `PLAN.md` en cada hito.

El destino solicitado es GitHub Pages, con base Vite `/atlas/`. `deploy.yml`
publica después de una CI correcta en `main`, o mediante ejecución manual en
`main`, y usa la base devuelta por `configure-pages`. No registres otros
servicios de hosting. La conexión actual no permite consultar la configuración
de Pages (HTTP 403); no afirmes que está activado ni que la URL funciona sin
verificarlo. No cambies la visibilidad privada del repositorio para habilitar
Pages. Para dominio propio se usa base `/` y CNAME; para VPS se sirve el build
estático con Nginx. Consulta README y PLAN para el estado de publicación.

## Trampas conocidas

- `atlas.config.json` debe seguir ignorado; versiona solo el ejemplo sin datos reales.
- El scanner de privacidad no sustituye al saneado del futuro pipeline.
- La Fase 1 no importa Timeline ni muestra viajes. Por defecto sirve la imagen
  NASA y los países Natural Earth desde `public/maps/`, sin servidores de mapas.
- El globo básico usa un elipsoide WGS84, sin relieve. El terreno de Cesium ion
  y los 3D Tiles de Google son opcionales y requieren claves/permisos del usuario.
- Los modos opcionales hacen peticiones externas relacionadas con la vista del
  mapa; no describas esos modos como completamente offline.
- Conserva las atribuciones visibles y la procedencia/licencias de los assets.
- Cesium se carga de forma diferida. Vite copia sus Workers, Assets, ThirdParty y
  Widgets al build bajo `cesium/`; `CESIUM_BASE_URL` debe respetar la base Vite.
- Respeta `prefers-reduced-motion`; la rotación automática debe detenerse al
  interactuar. Mantén alternativa accesible y mensaje recuperable si falla WebGL.
- El diálogo nativo tiene visibilidad controlada por el estado React. No añadas
  un `onClose` que sobrescriba ese estado: el evento puede llegar tras reabrirlo.
- Vite sirve `public/` desde la raíz del repo mediante `publicDir` explícito.
- `vite-plugin-static-copy` 4 conserva rutas: `stripBase: 4` retira el prefijo de
  los assets de Cesium. Un HTTP 200 con HTML en un worker indica una ruta errónea.
- Un build local correcto no demuestra que GitHub Actions o Pages hayan pasado.
