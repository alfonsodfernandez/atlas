# ATLAS — hoja de ruta

Estado inicial: repositorio vacío. Se empieza por la **Fase 0** y se mantiene un
proyecto funcional al cerrar cada hito. No se solicitan ni utilizan datos reales
para desarrollar. Este plan describe el alcance completo; las fases futuras no
son funcionalidades ya disponibles.

## Fase 0 — Andamiaje

Rama: `fase-0-andamiaje`.

- [x] Inicializar `main` con `.gitignore`, instrucciones de privacidad y enlace
      de `CLAUDE.md` a `AGENTS.md` antes de incorporar código.
- [x] Preparar el monorepo npm: `apps/web`, `packages/timeline-parser` y
      `packages/geo`.
- [x] Preparar Vite + React + TypeScript strict y pantalla inicial en español,
      sin datos personales ni globo operativo.
- [x] Configurar ESLint, Prettier, Vitest y Playwright.
- [x] Preparar guardia de privacidad, hook de pre-commit Husky y pruebas.
- [x] Preparar CI para privacidad, formato, lint, tipos, tests y build.
- [x] Documentar arranque, privacidad, arquitectura y fases.
- [x] Verificar instalación reproducible con `npm ci` y controles locales.
- [x] Comprobar E2E de la pantalla inicial en escritorio y móvil.
- [x] Confirmar CI verde en GitHub antes de fusionar la fase en `main`.

**Criterio de cierre:** `npm ci`, `npm run build` y `npm test` pasan en CI; los
controles adicionales de privacidad, formato, lint y tipos también están verdes.
La publicación comienza en Fase 1 y no bloquea este hito.

## Fase 1 — Globo

Rama prevista: `fase-1-globo`.

- [ ] Integrar CesiumJS con carga diferida y globo WGS84.
- [ ] Seleccionar imágenes sin clave y mostrar sus atribuciones.
- [ ] Añadir atmósfera, estrellas e iluminación día/noche.
- [ ] Rotación lenta que se detiene al interactuar; respetar movimiento reducido.
- [ ] Controles de ratón, táctil y teclado, con adaptación móvil.
- [ ] Incorporar países Natural Earth y documentar procedencia/licencia.
- [ ] Preparar opciones de Cesium ion y Google Photorealistic 3D Tiles con
      degradación a las imágenes gratuitas.
- [ ] Añadir E2E de canvas y ausencia de errores de la aplicación.
- [ ] Añadir `deploy.yml`, activar GitHub Pages cuando sea posible y verificar
      el despliegue desde `main`.

**Criterio de cierre:** una URL pública muestra el globo girable sin claves API.

## Fase 2 — Datos

Rama prevista: `fase-2-datos`.

- [ ] Investigar documentación y ejemplos actuales de las exportaciones de
      Timeline; guardar fuentes y fecha de consulta antes de programar parsers.
- [ ] Autodetectar Android on-device, iOS, Takeout semántico y Records antiguo.
- [ ] Normalizar visitas y movimientos; validar coordenadas, fechas y tipos.
- [ ] Leer fichero, carpeta o ZIP y deduplicar fuentes con solapes temporales.
- [ ] Crear muestras sintéticas inequívocas de 2–3 años y los tres formatos:
      base europea, viajes por Europa, Asia y América, vuelos y trayectos terrestres.
- [ ] Definir cómo generar y revisar fixtures sintéticas sin abrir una excepción
      general al control de privacidad.
- [ ] Incorporar países/regiones Natural Earth, ciudades GeoNames y aeropuertos
      OurAirports offline, con licencias y pasos reproducibles.
- [ ] Geocodificar país, región, ciudad y continente; probar fronteras y mar.
- [ ] Agrupar lugares y ciudades; detectar viajes y vuelos.
- [ ] Definir y validar con Zod el esquema versionado de `atlas.json`.
- [ ] Aplicar exclusiones, precisión de ciudad y fechas reducidas antes de generar
      la salida; probar que no escapa ningún punto excluido.
- [ ] Detectar candidatos a casa/trabajo y emitir avisos solo en el equipo local.
- [ ] Implementar CLI `npm run ingest -- <ruta>` con resumen e informe de
      privacidad y generar `public/data/atlas.json` sintético por defecto.
- [ ] Probar parsers, normalización, fusión, clustering, viajes, vuelos y saneado.

**Criterio de cierre:** la CLI convierte muestras sintéticas en un `atlas.json`
válido, saneado y con pruebas verdes, sin servicios de geocodificación remotos.

## Fase 3 — Visualización de datos

Rama prevista: `fase-3-visualizacion`.

- [ ] Colorear países según días visitados.
- [ ] Puntos por ciudad con tamaño, clustering y niveles de detalle.
- [ ] Arcos de vuelo animados y trazos terrestres activables.
- [ ] Panel de país/ciudad con fechas, días, ciudades y viajes relacionados.
- [ ] Vuelos de cámara al seleccionar un lugar y cabecera de estadísticas.
- [ ] E2E de selección y panel de detalle.

**Criterio de cierre:** el dataset sintético se representa correctamente y sus
lugares se pueden explorar en el globo y en una alternativa accesible de lista.

## Fase 4 — Tiempo y viajes

Rama prevista: `fase-4-tiempo-viajes`.

- [ ] Línea de tiempo y reproducción que actualizan las capas y siguen los viajes.
- [ ] Lista de viajes con tarjetas y tours de cámara entre sus paradas.
- [ ] Filtros por año, continente, transporte y tipo de lugar.
- [ ] Búsqueda de países y ciudades visitados.
- [ ] URLs con estado por país y viaje.
- [ ] E2E del efecto de la línea de tiempo y los filtros.

**Criterio de cierre:** filtros, búsqueda, reproducción y enlaces directos muestran
una selección coherente en el globo y los paneles.

## Fase 5 — Carga en navegador

Rama prevista: `fase-5-carga-local`.

- [ ] Arrastrar y soltar JSON/ZIP, con límites y errores comprensibles.
- [ ] Reutilizar parsers isomórficos en Web Worker sin subida a servidores.
- [ ] Configurar exclusiones y mostrar el informe de privacidad antes de descargar.
- [ ] Previsualizar datos procesados y descargar únicamente `atlas.json` saneado.
- [ ] Verificar mediante pruebas que los originales no generan peticiones de red.

**Criterio de cierre:** cualquier visitante puede explorar su propio historial y
descargar su atlas saneado con procesamiento íntegramente local.

## Fase 6 — Extras

Rama prevista: `fase-6-extras`.

- [ ] Estadísticas y gráficos por año, continente, país y transporte.
- [ ] Logros con reglas verificables y tarjeta para compartir.
- [ ] Mapa de calor opcional y fotos por viaje.
- [ ] Lugares manuales, ocultaciones y personalización de viajes en configuración.

**Criterio de cierre:** los extras usan datos agregados y respetan exclusiones y
las preferencias de precisión del usuario.

## Fase 7 — Pulido

Rama prevista: `fase-7-pulido`.

- [ ] Medir y mejorar carga, fluidez de Cesium y rendimiento en móvil.
- [ ] Revisar accesibilidad, teclado, contraste y movimiento reducido.
- [ ] Completar traducción al inglés sobre los textos centralizados.
- [ ] Completar E2E y medir Lighthouse en la parte no WebGL; objetivo ≥90 en
      rendimiento, accesibilidad y buenas prácticas.
- [ ] Documentar exportación actual de Android, iOS y Takeout con fuentes.
- [ ] Añadir capturas/GIF reales y guía final de carga y despliegue.

**Criterio de cierre:** aplicación documentada, accesible y verificada en los
dispositivos objetivo; registrar resultados medidos y sus límites.

## Decisiones / Pendiente de Alfonso

- **Fases:** se completa primero la Fase 0. Cesium, parsers y publicación tienen
  sus propios hitos; no se incorporan implementaciones parciales para aparentar
  que ya funcionan.
- **Git:** al estar vacío el repositorio, se inicializa `main` con un commit de
  privacidad y después se trabaja en `fase-0-andamiaje`. Commits convencionales
  pequeños, merge únicamente tras comprobar CI, nunca `push --force` a `main`.
- **Stack:** se mantiene Vite + React + TypeScript strict, npm workspaces,
  Zustand, Tailwind y Motion. Cesium sigue siendo la elección de Fase 1.
- **Dependencias:** Vite se declara también en la raíz para que Vitest y los
  plugins compartan una sola versión. Se fija una resolución de `minimatch`
  11.0.8 o posterior para `typescript-estree`, evitando la dependencia afectada
  por GHSA-g3hv-75wg-m249; lint y tipos verifican la compatibilidad.
- **Privacidad:** no se necesita información personal para Fase 0. Solo se
  versiona un ejemplo de configuración con listas vacías. Su estructura es
  provisional hasta que la Fase 2 defina el contrato y la validación.
- **Pruebas:** Vitest cubre las barreras de privacidad y la lógica que exista;
  Playwright empieza por flujos de la pantalla inicial. Se añaden pruebas reales
  del globo y de los parsers cuando esas funciones estén implementadas.
- **Investigación:** no se ha escrito ningún parser de Timeline. Antes de
  hacerlo hay que comprobar los formatos actuales en fuentes externas y citar
  sus ejemplos/documentación.
- **Datos sintéticos:** no hay estadísticas personales ni historial simulado
  presentado como real. El dataset representativo se construirá en Fase 2.
- **Hosting:** se respeta GitHub Pages como destino; no se crea otro servicio.
  La base inicial es `/atlas/`; la publicación comienza en Fase 1. El repositorio
  es privado: comprobar disponibilidad de Pages según el plan de la cuenta. Si
  exige cambiar su visibilidad, dejar esa decisión a Alfonso.
- **Claves opcionales:** no se necesitan en Fase 0. En Fase 1 se documentará el
  mapeo de secrets a variables Vite y las restricciones de dominio/API; las
  variables del cliente no son secretos.
- **Pendiente de Alfonso, más adelante:** exportar su historial en su equipo,
  revisar exclusiones y decidir qué lugares permite publicar con más precisión.
  Ninguna de estas decisiones bloquea el andamiaje.
- **Integración de Fase 0:** la revisión automática ha rechazado el merge de la
  PR #1 a `main` por exigir una autorización explícita en el chat para modificar
  la rama por defecto. El documento adjunto pide fusionar las fases verdes, pero
  el control no lo ha aceptado como autorización suficiente. La implementación
  está terminada y la CI de push y PR pasa; queda pendiente esa autorización
  para integrar. No se intentará eludir el bloqueo mediante Git u otro mecanismo.

## Validación del hito actual

Comprobado en local con Node.js 24 y npm 11:

- `npm ci`: instalación reproducible e instalación del hook correctas.
- `npm run check`: privacidad, formato, ESLint y TypeScript strict correctos;
  34 pruebas Vitest verdes.
- `npm run build`: build estático generado en `apps/web/dist/`.
- `npm run test:e2e`: 4 casos verdes entre escritorio y móvil, incluidos selección
  de fases, teclado, Escape y restauración del foco en el diálogo de privacidad.
- E2E sin errores de consola ni peticiones a servicios externos; sin desbordamiento
  horizontal, también comprobado a 320 px de ancho.
- Captura real de la pantalla inicial en `docs/images/fase-0.png`.
- `npm audit`: ninguna vulnerabilidad tras actualizar la resolución de
  `minimatch` y regenerar el lockfile.

CI completa de GitHub superada el 15 de noviembre de 2026 para `34f5097`:
[ejecución de CI](https://github.com/alfonsodfernandez/atlas/actions/runs/43740197181).
La integración de la Fase 0 se registra en la
[PR #1](https://github.com/alfonsodfernandez/atlas/pull/1); cualquier actualización
de la rama debe pasar sus comprobaciones antes del merge.

No hay despliegue público en Fase 0. El próximo hito es la Fase 1: Cesium y
GitHub Pages, manteniendo intactas las barreras de privacidad.
