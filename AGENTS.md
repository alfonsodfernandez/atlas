# ATLAS — instrucciones para agentes

## Alcance y fases

Lee `PLAN.md` antes de modificar el proyecto. Avanza en orden y deja cada fase
funcional. El encargo inicial autoriza completar la Fase 0; el globo, los parsers y
la publicación corresponden a los siguientes hitos. No presentes una maqueta como
un globo 3D operativo ni datos ficticios como el historial de Alfonso.

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
  Playwright para flujos de usuario; los E2E del globo llegan en Fase 1/3.

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

El destino solicitado es GitHub Pages, con base Vite `/atlas/`. El workflow de
publicación y la activación de Pages se implementan en Fase 1. No registres otros
servicios de hosting. Para dominio propio se configurará la base `/` y CNAME;
para VPS se servirá el build estático con Nginx. Consulta README para el estado
real y las instrucciones disponibles.

## Trampas conocidas

- `atlas.config.json` debe seguir ignorado; versiona solo el ejemplo sin datos reales.
- El scanner de privacidad no sustituye al saneado del futuro pipeline.
- La Fase 0 no importa Timeline ni carga mapas externos; el diseño orbital es SVG.
- Vite sirve `public/` desde la raíz del repo mediante `publicDir` explícito.
- Un build local correcto no demuestra que GitHub Actions o Pages hayan pasado.

