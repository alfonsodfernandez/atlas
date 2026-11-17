# ATLAS — hoja de ruta

El hito activo de la Fase 1 es **Tierra original de ATLAS**. El usuario eligió
continentes propios, geografía aproximada y ausencia de fronteras oficiales.
El motor de WebGL directo y la interfaz nativa se mantienen y se aligeran.

Se mantiene el avance por fases y un proyecto funcional en cada hito. No se
solicitan ni utilizan datos reales para desarrollar. Las funciones futuras de
Timeline, viajes y estadísticas siguen pendientes.

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

La implementación original con Cesium se integró mediante la
[PR #2](https://github.com/alfonsodfernandez/atlas/pull/2), commit `9ee8fbf` en
`main`. Su código, pruebas y captura están registrados en la validación histórica
al final del documento. El usuario ha pedido sustituirla por un motor propio para
reducir la lentitud; sus resultados no validan automáticamente la reescritura.

### Primera versión WebGL nativa

Rama: `fase-1-webgl-nativo`. Integrada en `ffebdb5` mediante la [PR #3](https://github.com/alfonsodfernandez/atlas/pull/3).
[CI de main](https://github.com/alfonsodfernandez/atlas/actions/runs/44167058562) y
[despliegue](https://github.com/alfonsodfernandez/atlas/actions/runs/44167643885)
verificados el 17 de noviembre de 2026.

- [x] Dibujar un elipsoide WGS84 con geometría, cámara, matrices y shaders GLSL
      propios sobre WebGL, con textura NASA, estrellas e iluminación.
- [x] Sustituir la interfaz por TypeScript, DOM y CSS nativos; retirar Cesium,
      React, Motion, Zustand y Tailwind del runtime y sus assets auxiliares.
- [x] Decodificar las fronteras binarias verificadas y dibujarlas en un lote GPU.
- [x] Mantener giro, zoom, inclinación, teclado y gestos táctiles.
- [x] Dibujar al cambiar la escena y pausar la animación cuando el visor o la
      pestaña dejan de estar visibles; respetar movimiento reducido.
- [x] Limitar resolución y densidad de píxeles para controlar el coste gráfico.
- [x] Mantener privacidad, ayuda, proyecto y vista accesible con foco y teclado.
- [x] Conservar atribuciones completas y visibles en escritorio y móvil.
- [x] Liberar recursos y recuperar pérdidas de contexto o fallos de carga.
- [x] Validar matemáticas, geometría, binario y privacidad con pruebas unitarias.
- [x] Verificar el renderizado real y los controles con E2E de escritorio/móvil.
- [x] Cumplir el presupuesto de 64 KiB de JS de build y 24 KiB con gzip.
- [x] Registrar comparación de tamaño y arranque con el mismo método antes/después.
- [x] Confirmar instalación limpia, formato, lint, tipos, tests y build locales.
- [x] Completar el E2E final tras los ajustes de liberación de recursos GPU.
- [x] Confirmar CI verde para la revisión nativa.
- [x] Publicar la revisión nativa y comprobar la URL y sus recursos.

**Criterio de cierre:** globo nativo funcional, presupuesto de descarga comprobado,
pruebas verdes y publicación verificada. Los informes de tamaño y arranque no
sustituyen una medición de FPS en dispositivos físicos.

### Tierra original — fase actual

Rama: `fase-1-tierra-original`.

- [x] Adoptar la geografía aproximada solicitada, con contornos originales y
      cuadrícula opcional.
- [x] Sustituir los recursos de cartografía de la primera versión nativa.
- [x] Dibujar planeta y estrellas en dos llamadas a la GPU y reutilizar la
      memoria de la cámara.
- [x] Limitar la resolución y la rotación automática. Mantener la interacción
      en el siguiente fotograma disponible.
- [x] Validar la textura, el presupuesto y los controles. La compilación suma
      48.006 bytes de JavaScript y CSS con gzip más el PNG. Las mediciones y su
      método están en [docs/performance/](docs/performance/).
- [ ] Verificar la CI y el despliegue.

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

- [ ] Medir y mejorar carga, fluidez del motor propio y rendimiento en móvil.
- [ ] Revisar accesibilidad, teclado, contraste y movimiento reducido.
- [ ] Completar traducción al inglés sobre los textos centralizados.
- [ ] Completar E2E y medir Lighthouse en la parte no WebGL; objetivo ≥90 en
      rendimiento, accesibilidad y buenas prácticas.
- [ ] Documentar exportación actual de Android, iOS y Takeout con fuentes.
- [ ] Añadir capturas/GIF reales y guía final de carga y despliegue.

**Criterio de cierre:** aplicación documentada, accesible y verificada en los
dispositivos objetivo; registrar resultados medidos y sus límites.

## Decisiones / Pendiente de Alfonso

- **Cambio autorizado de arquitectura:** el usuario indica que todo va demasiado
  lento y solicita programar la Tierra a mano y en bajo nivel. Se adopta WebGL
  directo con TypeScript/GLSL y una interfaz DOM/CSS. Esta petición sustituye la
  decisión inicial de Cesium y los frameworks de UI; se conserva Vite como
  herramienta de desarrollo y build.
- **Rendimiento medido antes del cambio:** el build de `9ee8fbf` contiene
  4.615.573 bytes de JS y 1.258.993 bytes con gzip, además de unos 14 MB de archivos
  publicados y 342 assets auxiliares del SDK. Informe exacto en
  [before-bundle.json](docs/performance/before-bundle.json).
- **Método de arranque:** Chromium con SwiftShader, navegador frío, viewport
  1280 × 850 a densidad 1, movimiento reducido y servidor local. La referencia
  registró 3.110 ms hasta el marcador de globo preparado y 3.406 ms hasta el de
  fronteras, 24 solicitudes y 8.312.969 bytes de recursos decodificados. Fuente:
  [before-runtime.json](docs/performance/before-runtime.json). Los marcadores
  miden inicialización de la aplicación, no FPS ni el fin de toda la rasterización.
- **Presupuesto y resultado:** el build nativo contiene 41.046 bytes de JS y
  14.920 bytes con gzip, dentro de los límites de 64 KiB y 24 KiB. La estimación
  inicial de JS/CSS con gzip y mapas es de 590.694 bytes, dentro de 700 KiB.
  La reducción de JavaScript bruto es del 99,1 %. Las métricas exactas y los
  límites de la comparación están en [docs/performance/README.md](docs/performance/README.md).
- **Cartografía actual:** contornos geográficos dibujados a mano con fines
  ilustrativos. El PNG indexado se obtiene desde código de ATLAS. La cuadrícula
  es un recurso de orientación y no representa límites políticos.
- **Fases:** el trabajo actual sigue dentro del globo de Fase 1. Los parsers,
  datos, viajes y estadísticas de Fase 2 y siguientes no están implementados.
- **Privacidad:** se mantienen el `.gitignore`, el hook del índice y el control
  de CI. El scanner no sustituye el saneado futuro; solo se versiona un ejemplo
  de configuración sin coordenadas personales.
- **Investigación:** antes de programar parsers hay que comprobar los formatos
  actuales de Timeline en fuentes externas y citar ejemplos/documentación.
- **Datos de desarrollo:** solo muestras sintéticas inequívocas cuando llegue
  la Fase 2; ninguna estadística inventada se presenta como historial de Alfonso.
- **Hosting:** GitHub Pages publicó la primera versión nativa y se verificó su
  renderizado. Cada publicación usa la revisión actual de main con CI correcta.
- **Git:** ramas por fase, commits convencionales y merge con comprobaciones
  verdes. Nunca `push --force` a `main`.
- **Pendiente de Alfonso, más adelante:** exportar su historial en su propio
  equipo y decidir zonas de exclusión y lugares públicos. Ninguno de esos datos
  es necesario para desarrollar el motor.

## Validación histórica de la primera reescritura nativa

Comprobaciones locales comunicadas para la revisión nativa:

- `npm ci`, `npm run check` y `npm run build`: correctos; 48 pruebas Vitest verdes.
- JavaScript de build: **41.046 bytes brutos / 14.920 bytes gzip** frente a
  **4.615.573 / 1.258.993** anteriores. Reducción del 99,1 % en JS bruto.
- CSS con gzip: 4.011 bytes. NASA: 356.467 bytes. Fronteras: 215.296 bytes.
  Estimación inicial de JS/CSS con gzip y mapas: 590.694 bytes; excluye HTML y
  cabeceras. `check:bundle` cumple los tres presupuestos registrados.
- Una muestra fría por versión con el mismo método dio **3.110 → 247 ms** hasta
  el marcador del globo y **3.406 → 292 ms** hasta el de fronteras. Los subrecursos
  pasaron de 24 a 5; sus bytes decodificados, de 8.312.969 a 627.383. Se observaron
  6 tareas largas / 735 ms antes y 1 / 139 ms después.
- Captura real del visor: [webgl-nativo.png](docs/images/webgl-nativo.png).
- Informes: [before-bundle.json](docs/performance/before-bundle.json),
  [after-bundle.json](docs/performance/after-bundle.json),
  [before-runtime.json](docs/performance/before-runtime.json) y
  [after-runtime.json](docs/performance/after-runtime.json).
  [Método y reproducción](docs/performance/README.md).

La ejecución E2E final pasa los 14 casos en 35,9 segundos, incluidos recuperación
de contexto, gestos táctiles, imagen real y reposo sin dibujar. La CI de `8020fb0`
pasa en [push](https://github.com/alfonsodfernandez/atlas/actions/runs/43900026345)
y [PR](https://github.com/alfonsodfernandez/atlas/actions/runs/43900237582).
La [PR #3](https://github.com/alfonsodfernandez/atlas/pull/3) se integró como
`ffebdb5` y se verificó la versión pública. Las cifras de SwiftShader describen
el entorno de prueba y la disponibilidad inicial del globo.

## Validación histórica de Fase 0

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

## Validación histórica de Fase 1 con Cesium

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

En esa verificación histórica faltaba comprobar la publicación. La API de Pages
devolvía 403 y la URL esperada devolvía 404. El navegador compartido tampoco pudo
abrir la configuración en aquella sesión por un error del entorno y se documentó
el paso manual. Después, el usuario mostró la fuente GitHub Actions guardada;
el despliegue actual debe verificarse de nuevo.

En esa revisión no se verificó una URL pública ni el funcionamiento con claves
opcionales de Cesium ion o Google. Esos modos pertenecen a la implementación
anterior y se retiran en la reescritura nativa.
