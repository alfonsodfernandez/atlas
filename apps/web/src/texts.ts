// Keep interface copy together so a second locale can be added without changing UI.
export const texts = {
  es: {
    skip: 'Saltar al contenido',
    tagline: 'CADA LUGAR, UNA HISTORIA',
    project: 'El proyecto',
    roadmap: 'Hoja de ruta',
    privacy: 'Privacidad',
    status: 'Fase 0 · Base preparada',
    eyebrow: 'TU PRÓXIMO GRAN VIAJE EMPIEZA AQUÍ',
    title: ['El mundo,', 'tu historia.'],
    intro:
      'Un atlas personal de los lugares que has visitado. Tu historia de viajes, sobre un planeta que podrás explorar a tu ritmo.',
    planAction: 'Descubrir el plan',
    privacyAction: 'La privacidad, primero',
    progress: 'ESTAMOS CONSTRUYENDO ATLAS',
    progressDescription:
      'La estructura ya está lista. El siguiente paso es dar vida al globo 3D.',
    artwork: 'ESTUDIO ORBITAL',
    artworkCaption:
      'Ilustración del proyecto · El globo interactivo llega en la fase 1',
    principlesLabel: 'LOS CIMIENTOS',
    principlesTitle: 'Un mapa muy tuyo.',
    principlesIntro:
      'Pensado para explorar el mundo. Diseñado para cuidar tu historia.',
    principles: [
      {
        icon: 'shield',
        title: 'Privado desde el origen',
        description:
          'El historial original permanecerá en tu equipo. La futura importación publicará solo información agregada y saneada.',
      },
      {
        icon: 'orbit',
        title: 'El planeta como lienzo',
        description:
          'Un globo 3D será el centro de la experiencia: países, ciudades y viajes conectados sobre la Tierra.',
      },
      {
        icon: 'layers',
        title: 'Paso a paso, con rumbo',
        description:
          'Ocho fases, una base comprobable en cada una. Este primer hito prepara el proyecto para lo que viene.',
      },
    ],
    roadmapLabel: 'EL CAMINO POR DELANTE',
    roadmapTitle: 'De la primera línea al mundo entero.',
    roadmapIntro: 'Selecciona una fase para conocer su alcance.',
    phaseReady: 'Preparada',
    phaseNext: 'Siguiente',
    phaseFuture: 'Por construir',
    phaseLabel: 'Fase',
    phases: [
      {
        title: 'Andamiaje',
        subtitle: 'Una base sólida',
        description:
          'Monorepo, interfaz inicial, TypeScript estricto, herramientas de calidad, pruebas y controles para impedir que el historial crudo llegue al repositorio.',
      },
      {
        title: 'Globo',
        subtitle: 'Dar vida al planeta',
        description:
          'Cesium, imágenes sin clave, atmósfera, iluminación y controles de cámara. También llegará la primera publicación en GitHub Pages.',
      },
      {
        title: 'Datos',
        subtitle: 'Tu historia, en local',
        description:
          'Investigar los formatos actuales de Timeline, crear los parsers, enriquecer ubicaciones sin conexión y generar un JSON agregado con zonas de exclusión.',
      },
      {
        title: 'Visualización',
        subtitle: 'Cada viaje toma forma',
        description:
          'Países coloreados, ciudades, arcos de vuelo, estadísticas y paneles de detalle. El desarrollo usará únicamente datos sintéticos.',
      },
      {
        title: 'Tiempo y viajes',
        subtitle: 'Volver a recorrerlo',
        description:
          'Una línea de tiempo, reproducción de viajes, recorridos de cámara, filtros, búsqueda y enlaces a vistas concretas.',
      },
      {
        title: 'Carga local',
        subtitle: 'Tus datos, tu control',
        description:
          'Importar JSON o ZIP en el navegador, procesarlo en un Web Worker y descargar el resultado saneado. Sin enviar el historial a un servidor.',
      },
      {
        title: 'Extras',
        subtitle: 'Historias para compartir',
        description:
          'Gráficos, logros, una tarjeta para compartir, mapa de calor y fotografías opcionales por viaje.',
      },
      {
        title: 'Pulido',
        subtitle: 'Listo para explorar',
        description:
          'Rendimiento móvil, accesibilidad, interfaz en inglés y pruebas completas. Una guía final explicará cómo exportar y cargar tus datos.',
      },
    ],
    footer: 'Hecho para recordar dónde has estado. Y soñar con lo que queda.',
    footerVersion: 'ATLAS / FASE 0',
    privacyDialog: {
      eyebrow: 'TU HISTORIA TE PERTENECE',
      title: 'Explorar sin exponerte.',
      intro:
        'La privacidad forma parte de los cimientos de Atlas. Esta fase todavía no permite importar datos ni muestra ubicaciones personales.',
      items: [
        {
          title: 'El original se queda contigo',
          description:
            'El futuro pipeline procesará tu exportación en tu ordenador. Nunca subas un archivo original de Timeline al repositorio.',
        },
        {
          title: 'Solo se compartirá lo que elijas',
          description:
            'La salida estará agrupada por ciudad, sin horas exactas y con zonas de exclusión para casa, trabajo y otros lugares sensibles.',
        },
        {
          title: 'Una primera barrera ya está activa',
          description:
            'Git ignora los archivos privados y un control de pre-commit y CI busca formatos crudos. El saneado de ubicaciones se implementará en la fase 2.',
        },
      ],
      close: 'Entendido',
      closeLabel: 'Cerrar información de privacidad',
    },
  },
} as const;

export const copy = texts.es;
