# ATLAS — instrucciones para agentes

## Alcance y decisión vigente

Lee `PLAN.md` antes de modificar el proyecto. El visor está en la Fase 1.
El usuario eligió una Tierra original de ATLAS con continentes dibujados a mano
y geografía aproximada, sin fronteras oficiales. Mantén la generación visual
en código propio, el renderizador en WebGL 2 y la interfaz en TypeScript y CSS.

Investiga los formatos actuales antes de implementar parsers de Timeline y
distingue los datos sintéticos de un historial personal.

## Arranque y comandos

- Node.js 24 LTS y npm 11; monorepo con npm workspaces.
- `npm ci`: instalación según lockfile e instalación del hook Husky.
- `npm run dev`: Vite en `http://localhost:5173/atlas/`.
- `npm run check`: privacidad, formato, lint, tipos y pruebas unitarias.
- `npm run build`: build estático en `apps/web/dist/` y control del presupuesto.
- `npm run check:bundle`: comprueba JS bruto, gzip, recursos iniciales y ausencia
  de los assets anteriores; debe ejecutarse sobre un build existente.
- `npm run measure:runtime -- <url> <informe.json>`: mide el arranque con el método
  documentado en `docs/performance/README.md`.
- `npm run preview`: sirve el build.
- `npm run test:e2e`: Playwright; instala Chromium una vez con
  `npx playwright install chromium`.
- `npm run check:privacy`: ficheros versionados y nuevos no ignorados;
  `npm run check:privacy -- --staged`: blobs exactos del índice.
- `ATLAS_BASE_PATH=/ npm run build`: build para la raíz de un dominio.
- `node scripts/prepare-earth.mjs [--check]`: genera la textura original o
  comprueba que coincide con la versión guardada.

El visor nativo no utiliza claves de mapas ni requiere `.env.local`.

## Estructura y convenciones

- `apps/web/`: TypeScript strict, DOM/CSS nativos y motor WebGL propio.
- `apps/web/src/globe/`: matemáticas, geometría, shaders, cámara y recursos GPU.
- `packages/timeline-parser/`: futura lógica isomórfica de importación; sin APIs
  de Node. Investiga los formatos actuales antes de escribir parsers.
- `packages/geo/`: futura geocodificación offline.
- `scripts/`: calidad, generación reproducible y mediciones.
- `public/data/`: futura salida agregada y saneada.
- `public/maps/`: PNG indexado generado por ATLAS y documentación del dibujo.
- UI y documentación en español; conserva los textos centralizados para i18n.
- Usa eventos con limpieza explícita y conserva el foco y el teclado en diálogos.
- Valida entradas de buffers y límites antes de crear vistas o reservar memoria.
- Reutiliza geometría, buffers, texturas y matrices; evita asignaciones por frame.
- Dibuja al cambiar la escena. La rotación puede programar frames mientras está
  activa; suspéndelos si el documento o el visor dejan de estar visibles.
- Respeta movimiento reducido y los límites de resolución del renderizador.
- Mantén los presupuestos verificados de 48 KiB de JS, 20 KiB con gzip y
  64 KiB de estimación inicial para JS/CSS con gzip más textura.
- Los informes de arranque comparan una muestra fría por versión con SwiftShader.
  No los presentes como FPS ni como tiempos garantizados en hardware físico.
- Vitest comprueba matemáticas, geometría, decodificación y privacidad.
  Playwright debe renderizar el WebGL real para verificar el globo. Un mock solo
  es apropiado para probar un fallo de contexto concreto.

## Privacidad obligatoria

Los originales de Timeline se procesarán únicamente en el ordenador del usuario.
Nunca solicites ni incorpores exportaciones reales, coordenadas de casa, trabajo
ni rutinas. `data/raw/`, `atlas.config.json` y los nombres de exportación están
ignorados. Mantén esos archivos fuera del índice; nunca uses `git add -f` para
incluirlos ni desactives el hook de privacidad.

El pre-commit inspecciona los blobs del índice y CI revisa el árbol. Los fallos
no deben imprimir contenido sensible. El scanner no sustituye el saneado de la
futura Fase 2. Las muestras crudas se generarán en memoria o como fixtures de
código inequívocamente sintéticas y acotadas. Cualquier excepción necesita una
justificación concreta y pruebas; nunca excluyas una carpeta completa para
permitir datos crudos.

## Git y despliegue

Ramas por fase, commits convencionales y cambios lógicos pequeños. Fusiona en
`main` con controles verdes; nunca fuerces la rama. Conserva las ediciones del
usuario y actualiza `PLAN.md` al cerrar cada hito.

El destino solicitado es GitHub Pages con base `/atlas/`. El workflow publica
la revisión actual de `main` después de una CI correcta, o se ejecuta manualmente
desde `main`; comprueba de nuevo que la revisión siga vigente antes de publicar.
Sube únicamente `apps/web/dist/`. No registres otro hosting ni cambies la
visibilidad del repositorio para resolver su configuración.

El usuario ha mostrado **Source: GitHub Actions** guardado en Pages. Comprueba el
resultado real del workflow y la web antes de afirmar que se ha publicado. Los
403/404 anteriores forman parte del historial, no prueban su estado actual.

## Trampas conocidas

- La Fase 1 no importa Timeline ni representa visitas personales.
- El globo es una ilustración geográfica aproximada. La futura geocodificación
  de viajes requerirá datos adecuados y no debe usar su máscara de tierra.
- La textura y la cuadrícula son locales. Conserva el crédito de ATLAS visible.
- El shader terrestre integra cuadrícula e iluminación en una pasada opaca y
  las estrellas se dibujan en una sola pasada aparte.
- El elipsoide convexo se dibuja sin búfer de profundidad. Si se añaden
  objetos que deban ocluirse entre sí, revisa ese supuesto. La textura se sube
  en RGB565 y el PNG comprimido se conserva para recuperar WebGL.
- Los eventos de pérdida/restauración de WebGL y el reintento deben liberar y
  reconstruir recursos; también aborta descargas pendientes al destruir el visor.
- Los metadatos de cámara deben leer el estado real al ejecutar un comando,
  además de acompañar movimientos animados; un frame retrasado no debe dejar
  descripciones obsoletas.
- Evita la realimentación de eventos de cierre diferidos en los diálogos. Conserva
  el disparador original y restaura el foco en cada cierre/reapertura.
- Vite sirve `public/` desde la raíz mediante `publicDir` y todas las URLs de
  recursos deben respetar la base configurada.
- Una medición con SwiftShader no es una medición de FPS en un móvil físico.
- Un build local correcto no acredita una CI ni un despliegue público correctos.
