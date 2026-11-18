# ATLAS — instrucciones para agentes

## Alcance y decisión vigente

Lee `PLAN.md` antes de modificar el proyecto. El hito actual es el rediseño de
la Fase 1 con el globo como escena principal. Mantén el motor WebGL 2 propio, la
interfaz TypeScript/CSS y los controles nativos, con cartografía simplificada de
Natural Earth y carga progresiva de detalle al hacer zoom.

El ejemplo visible utiliza exclusivamente España (`ESP`), México (`MEX`) y Japón
(`JPN`) como datos ficticios. Mantén el aviso de ejemplo junto a sus cifras y
paneles. No lo presentes como el historial de Alfonso ni completes por ello las
fases de importación, saneado o estadísticas personales.

Investiga los formatos actuales antes de implementar parsers de Timeline y
mantén separados los ejemplos de UI y los futuros datos personales agregados.

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
- `node scripts/prepare-map.mjs [--check]`: genera las máscaras cartográficas
  inicial y de detalle, o comprueba que coinciden con las versiones guardadas.

El visor nativo no utiliza claves de mapas ni requiere `.env.local`.

## Estructura y convenciones

- `apps/web/`: TypeScript strict, DOM/CSS nativos y motor WebGL propio.
- `apps/web/src/globe/`: matemáticas, geometría, shaders, cámara y recursos GPU.
- `packages/timeline-parser/`: futura lógica isomórfica de importación; sin APIs
  de Node. Investiga los formatos actuales antes de escribir parsers.
- `packages/geo/`: futura geocodificación offline.
- `scripts/`: calidad, generación reproducible y mediciones.
- `public/data/`: futura salida agregada y saneada.
- `public/maps/`: máscara inicial y máscara de detalle que se carga bajo demanda.
- `scripts/geo/`: fuente Natural Earth fijada; no se publica con la web.
- `docs/cartografia.md`: procedencia, licencia y generación de la máscara.
- UI y documentación en español; conserva los textos centralizados para i18n.
- Usa eventos con limpieza explícita y conserva el foco y el teclado en diálogos.
- Valida entradas de buffers y límites antes de crear vistas o reservar memoria.
- Reutiliza geometría, buffers, texturas y matrices; evita asignaciones por frame.
- Dibuja al cambiar la escena. La rotación puede programar frames mientras está
  activa; suspéndelos si el documento o el visor dejan de estar visibles.
- Respeta movimiento reducido y los límites de resolución del renderizador.
- Respeta los presupuestos de `scripts/check-bundle.mjs`: 40 KiB de JS bruto,
  15 KiB de JS con gzip, 44 KiB de estimación inicial JS/CSS con gzip más el
  mapa base y 64 KiB adicionales para el mapa de detalle. Registra los pesos
  reales de la revisión. Separa la descarga inicial de la máscara de detalle;
  un recurso de zoom diferido no debe contarse como una descarga inicial.
- Conserva los informes anteriores como históricos. Un rediseño necesita sus
  propias medidas de tamaño, arranque y respuesta de los controles.
- Los informes de arranque comparan muestras frías por versión con SwiftShader.
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

- La Fase 1 no importa Timeline. ESP/MEX/JPN son ejemplos ficticios de UI;
  los contadores de la demostración no son estadísticas personales.
- Las fronteras simplificadas son para visualización; no prometen precisión
  topológica o legal. La geocodificación futura usará geometrías adecuadas.
- Conserva el crédito y la licencia de Natural Earth. Las fuentes 1:110m y
  1:50m tienen 177 y 242 entidades; no son países visitados ni el total mundial.
- Las máscaras usan rojo para tierra, verde para fronteras y azul para la unión
  de los tres países de ejemplo. El azul no es un identificador por país ni
  proporciona una operación de geocodificación o selección exacta.
- Mantén el mismo contrato de canales en la máscara inicial y la de detalle.
  Evita formatos de textura que alteren los canales sin verificar el resultado.
- El globo usa una sola pasada WebGL. Mantén la generación y simplificación
  cartográfica fuera del trabajo de cada frame.
- `atlas-map.png` es la máscara inicial 1024 × 512 de Natural Earth 1:110m.
  `atlas-map-detail.png`, de 2048 × 1024 y Natural Earth 1:50m, se solicita al
  acercarse. No la precargues antes de la primera vista por comodidad.
- Los PNG son recursos de visualización generados; las fuentes de Natural Earth
  quedan en `scripts/geo/` y no deben copiarse al directorio público.
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
