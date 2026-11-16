# ATLAS — hoja de ruta

La **Fase 0 está integrada en `main`** y se trabaja en la **Fase 1 — Globo**.
La publicación sigue pendiente de verificar. Se mantiene un proyecto funcional
al cerrar cada hito, sin solicitar ni utilizar datos reales para desarrollar.
Este plan describe el alcance completo; las fases futuras no son funcionalidades
ya disponibles.

## Fase 0 — Andamiaje

Rama: `fase-0-andamiaje`.

Integrada mediante la [PR #1](https://github.com/alfonsodfernandez/atlas/pull/1),
commit `bcbb4b4` en `main`, tras la indicación de continuar del usuario.

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

Rama: `fase-1-globo`. Código verificado en local y CI; queda pendiente comprobar
la publicación. Las casillas de código no sustituyen el despliegue operativo.

- [x] Integrar CesiumJS con carga diferida y globo WGS84.
- [x] Seleccionar imagen NASA sin clave, servida localmente, y mostrar atribuciones.
- [x] Añadir atmósfera, estrellas e iluminación día/noche.
- [x] Rotación lenta que se detiene al interactuar; respetar movimiento reducido.
- [x] Controles de ratón, táctil y teclado, con adaptación móvil y alternativa
      accesible ante fallo de WebGL.
- [x] Incorporar países Natural Earth 1:50m y documentar procedencia/licencia.
- [x] Preparar opciones de Cesium ion y Google Photorealistic 3D Tiles con
      degradación a las imágenes gratuitas.
- [x] Añadir E2E de canvas y ausencia de errores de la aplicación.
- [x] Añadir `deploy.yml`, condicionado a CI correcta en `main`, y ejecución manual.
- [x] Verificar instalación limpia, calidad, build y E2E del globo.
- [x] Confirmar CI verde para la revisión actual de la Fase 1.
- [ ] Activar GitHub Pages y verificar el despliegue desde `main`.
- [ ] Comprobar que la URL pública muestra el globo girable sin claves API.

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

- **Fases:** Fase 0 integrada; Fase 1 en curso. Los parsers, datos y estadísticas
  pertenecen a los siguientes hitos y todavía no están disponibles.
- **Git:** al estar vacío el repositorio, se inicializa `main` con un commit de
  privacidad y después se trabaja en `fase-0-andamiaje`. Commits convencionales
  pequeños, merge únicamente tras comprobar CI, nunca `push --force` a `main`.
- **Stack:** se mantiene Vite + React + TypeScript strict, npm workspaces,
  Zustand, Tailwind y Motion. Cesium se integra en Fase 1 con importación
  diferida y assets de runtime copiados localmente. Referencia:
  [guía oficial de CesiumJS](https://cesium.com/learn/cesiumjs-learn/cesiumjs-quickstart/).
- **Mapa básico:** textura NASA Blue Marble y países Natural Earth 1:50m
  versionados en `public/maps/`, sin peticiones a proveedores de mapas en
  runtime. El globo básico es un elipsoide WGS84, sin relieve ni edificios. Los
  datos geográficos no representan visitas y las 242 entidades de Natural Earth
  incluyen territorios y áreas disputadas; no son un contador de países visitados.
  Fuentes, licencias y hashes en [public/maps/README.md](public/maps/README.md).
- **Dependencias:** Vite se declara también en la raíz para que Vitest y los
  plugins compartan una sola versión. Se fija una resolución de `minimatch`
  11.0.8 o posterior para `typescript-estree`, evitando la dependencia afectada
  por GHSA-g3hv-75wg-m249; lint y tipos verifican la compatibilidad.
- **Privacidad:** no se necesita información personal para Fase 0. Solo se
  versiona un ejemplo de configuración con listas vacías. Su estructura es
  provisional hasta que la Fase 2 defina el contrato y la validación.
- **Pruebas:** Vitest cubre las barreras de privacidad, la cartografía y la lógica
  que exista; Playwright comprueba el globo real en la Fase 1. Los parsers tendrán
  pruebas cuando se implementen. No se da por verificado WebGL con un mock.
- **Investigación:** no se ha escrito ningún parser de Timeline. Antes de
  hacerlo hay que comprobar los formatos actuales en fuentes externas y citar
  sus ejemplos/documentación.
- **Datos sintéticos:** no hay estadísticas personales ni historial simulado
  presentado como real. El dataset representativo se construirá en Fase 2.
- **Hosting:** se respeta GitHub Pages como destino; no se crea otro servicio.
  La base local es `/atlas/`; el workflow usa la base de `configure-pages`.
  La consulta a la configuración de Pages devuelve HTTP 403 (`Resource not
accessible by integration`). La activación y la URL pública no están
  verificadas. Alfonso puede comprobar Settings → Pages → GitHub Actions y la
  disponibilidad según el plan; no se cambia la visibilidad privada del repo.
- **Claves opcionales:** `.env.local` en la raíz configura
  `VITE_CESIUM_ION_TOKEN` y `VITE_GOOGLE_MAPS_API_KEY`. En Actions, los secrets
  `CESIUM_ION_TOKEN` y `GOOGLE_MAPS_API_KEY` se mapean a esas variables al compilar.
  El modo básico no necesita claves. Las variables del cliente son públicas;
  los mapas opcionales hacen peticiones a los proveedores y requieren las
  restricciones de dominio/API correspondientes.
- **Pendiente de Alfonso, más adelante:** exportar su historial en su equipo,
  revisar exclusiones y decidir qué lugares permite publicar con más precisión.
  Ninguna de estas decisiones bloquea el andamiaje.
- **Integración de Fase 0:** resuelta. Tras la indicación de continuar del usuario,
  la PR #1 se fusionó correctamente en `main` como `bcbb4b4`. El rechazo de
  aprobación anterior ya no bloquea esta fase.

## Validación de Fase 0

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
- Una ejecución posterior de CI detectó una carrera al reabrir el diálogo tras
  pulsar Escape. Se reprodujo localmente (5 fallos en 20 repeticiones) y se
  eliminó el evento de cierre nativo que sobrescribía una apertura nueva.
  El E2E ahora repite cierres y reaperturas sin pausas artificiales.
  Tras la corrección pasan 20 repeticiones entre escritorio y móvil, y vuelve a
  pasar la suite completa de 4 E2E. CI conserva trazas y capturas al fallar.
- `npm audit`: ninguna vulnerabilidad tras actualizar la resolución de
  `minimatch` y regenerar el lockfile.

CI completa de GitHub superada el 15 de noviembre de 2026 para `34f5097`:
[ejecución de CI](https://github.com/alfonsodfernandez/atlas/actions/runs/43740197181).
La integración de la Fase 0 se registra en la
[PR #1](https://github.com/alfonsodfernandez/atlas/pull/1), fusionada en `main`
como `bcbb4b4`.

La Fase 0 no tuvo despliegue público. Sus resultados describen el andamiaje de
ese momento, no la verificación del globo de la Fase 1.

## Validación de Fase 1

Comprobado en el entorno de desarrollo:

- `npm ci`, `npm run check` y `npm run build`: correctos; 37 pruebas Vitest verdes.
- `npm run test:e2e`: 10 casos verdes en escritorio y móvil. Cesium se renderiza
  realmente mediante WebGL 2; se comprueban cámara, inclinación, teclado, capas,
  rotación, movimiento reducido, privacidad y alternativa sin WebGL.
- La carga básica no produce errores ni peticiones a servicios externos.
- La cartografía coincide con sus hashes y mantiene anillos cerrados y
  coordenadas válidas. `node scripts/prepare-maps.mjs` reproduce los assets.
- `actionlint` valida los workflows; `npm audit` no detecta vulnerabilidades.
- Captura real con fronteras en `docs/images/fase-1.png`. La geometría de las
  fronteras se prepara de forma asíncrona tras cargar el globo.
- Se corrigió la estructura de copia de `vite-plugin-static-copy` 4: se retira
  el prefijo `node_modules/cesium/Build/Cesium` para servir `/atlas/cesium/`.
- Las pruebas usan SwiftShader y no constituyen una medición de FPS en hardware
  de escritorio o móvil; esa medición corresponde al pulido de la Fase 7.
- El 16 de noviembre se identificó un retraso en los metadatos de cámara bajo
  renderizado por software: la cámara ya había girado, pero el evento del
  siguiente frame aún no había actualizado su descripción. Ahora se lee la
  posición real inmediatamente después de cada comando, sin ampliar los tiempos
  de espera de las pruebas ni modificar el movimiento de la cámara.

CI completa superada para `8e20b0a` el 16 de noviembre de 2026 tanto en
[push](https://github.com/alfonsodfernandez/atlas/actions/runs/43832305994) como en
[PR](https://github.com/alfonsodfernandez/atlas/actions/runs/43832314199).
La integración de este hito se sigue en la
[PR #2](https://github.com/alfonsodfernandez/atlas/pull/2).

Falta comprobar la publicación en GitHub Pages. La API de Pages devuelve 403 y
la URL esperada devuelve 404; no se presenta como un despliegue operativo. El
navegador compartido tampoco pudo abrir la configuración en esta sesión por un
error del entorno, por lo que la activación puede requerir la intervención del
propietario en Settings → Pages → GitHub Actions.

No se ha verificado una URL pública ni el funcionamiento con claves opcionales
de Cesium ion o Google. La configuración básica no depende de esas claves.
