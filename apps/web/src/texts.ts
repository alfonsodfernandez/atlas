// Keep interface copy together so another locale can be added without changing UI.
export const texts = {
  es: {
    skip: 'Saltar al globo',
    brand: 'Atlas, inicio',
    tagline: 'CADA LUGAR, UNA HISTORIA',
    project: 'El proyecto',
    navigationLabel: 'Navegación principal',
    layersLabel: 'Capas del globo',
    cameraControlsLabel: 'Controles de cámara',
    attributionsLabel: 'Fuente de la cartografía',
    cartographyCredit: 'Natural Earth',
    cartographyNote: 'Fronteras simplificadas',
    phasesLabel: 'Fases del proyecto',
    privacy: 'Privacidad',
    accessible: 'Vista accesible',
    help: 'Cómo explorar',
    eyebrow: 'UN MUNDO POR RECORRER',
    title: ['El mundo,', 'tu historia.'],
    intro: 'Gira el globo y acércate para explorar sus fronteras.',
    emptyDescription: 'Todavía no hay viajes cargados.',
    globeLabel: 'Globo terráqueo 3D',
    globeInstructions:
      'Globo con fronteras simplificadas. Arrastra para girar. Usa la rueda o un pellizco para acercarte. Pulsa Tab para acceder a los controles.',
    home: 'Vista inicial',
    zoomIn: 'Acercar',
    zoomOut: 'Alejar',
    tilt: 'Cambiar inclinación',
    rotation: 'Rotación automática',
    borders: 'Fronteras',
    reducedMotion:
      'La rotación está pausada por tu preferencia de movimiento reducido.',
    status: {
      loading: 'Preparando el planeta…',
      ready: 'Listo para explorar',
      error: 'No se ha podido mostrar el globo',
    },
    fallback: {
      title: 'El mundo sigue aquí.',
      description:
        'El globo no está disponible en este momento. Vuelve a intentarlo; si tu navegador no ofrece aceleración gráfica, puedes seguir con la vista accesible.',
      retry: 'Volver a intentar',
    },
    close: 'Cerrar ventana',
    understood: 'Entendido',
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
            'Git ignora los archivos privados y un control de pre-commit y CI busca formatos crudos. El saneado de ubicaciones llegará en la fase 2.',
        },
      ],
    },
    projectDialog: {
      eyebrow: 'UN PLANETA DE HISTORIAS',
      title: 'Estamos construyendo Atlas.',
      intro:
        'Un atlas personal de viajes, con la Tierra como lienzo y la privacidad como punto de partida. Selecciona una fase para conocer el camino.',
      ready: 'Completada',
      current: 'Fase actual',
      future: 'Por construir',
    },
    phases: [
      {
        title: 'Andamiaje',
        subtitle: 'Una base sólida',
        description:
          'Monorepo, TypeScript estricto, herramientas de calidad, pruebas y controles para impedir que el historial crudo llegue al repositorio.',
      },
      {
        title: 'Globo',
        subtitle: 'El planeta cobra vida',
        description:
          'Un globo con fronteras simplificadas de Natural Earth, una superficie neutra y controles de cámara.',
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
          'Lugares, ciudades, arcos de vuelo, estadísticas y paneles de detalle. El desarrollo usará únicamente datos sintéticos.',
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
    helpDialog: {
      eyebrow: 'ENCUENTRA OTRA PERSPECTIVA',
      title: 'El mundo está en tus manos.',
      intro:
        'Todos los movimientos tienen un control en pantalla. La rotación es opcional y se detiene al interactuar con el globo.',
      items: [
        {
          title: 'Ratón',
          description:
            'Arrastra para girar, usa la rueda para acercarte y arrastra con el botón central para inclinar la cámara.',
        },
        {
          title: 'Pantalla táctil',
          description:
            'Arrastra con un dedo para girar. Pellizca para acercarte y arrastra con dos dedos para inclinar.',
        },
        {
          title: 'Teclado',
          description:
            'Con el globo enfocado, las flechas giran la vista, + y − controlan la distancia e Inicio vuelve a la vista inicial. Tab permite salir del globo.',
        },
      ],
    },
    accessibleDialog: {
      eyebrow: 'OTRA FORMA DE EXPLORAR',
      title: 'Atlas, sin barreras.',
      intro:
        'Este globo muestra las fronteras de Natural Earth, simplificadas para su visualización. Todavía no hay viajes cargados ni estadísticas personales.',
      explorerLabel: 'Explorador',
      cartographyLabel: 'Representación',
      cartographyDescription: 'Globo con fronteras simplificadas',
      bordersLabel: 'Fronteras',
      bordersVisible: 'Visibles',
      bordersHidden: 'Ocultas',
      dataLabel: 'Datos personales',
      noData: 'No se ha cargado ningún historial',
      controls: 'Controles del explorador',
      controlsDescription:
        'Los botones permiten acercar, alejar, cambiar la inclinación y volver al inicio. Las fronteras se muestran al abrir el visor y puedes ocultarlas. La rotación solo se activa si la eliges.',
      next: 'Lo que llegará después',
      nextDescription:
        'Cuando exista el historial agregado, aquí podrás recorrer tus lugares y viajes como una lista, sin depender del globo.',
      projectAction: 'Ver la hoja de ruta',
    },
  },
} as const;

export const copy = texts.es;
