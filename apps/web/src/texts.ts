export const texts = {
  es: {
    brand: 'Atlas, volver al globo',
    pageTitle: 'Atlas · Explorador del mundo',
    skip: 'Saltar al globo',
    globeLabel: 'Globo terráqueo 3D',
    globeInstructions:
      'Arrastra para girar, usa la rueda o un pellizco para acercarte. Con el globo enfocado, las flechas giran la vista, + y − cambian la distancia e Inicio vuelve al principio. Tab permite salir del globo.',
    controlsLabel: 'Controles del globo',
    home: 'Vista inicial',
    zoomIn: 'Acercar',
    zoomOut: 'Alejar',
    tilt: 'Cambiar inclinación',
    rotation: 'Rotación automática',
    borders: 'Fronteras',
    help: 'Ayuda',
    privacy: 'Privacidad',
    accessible: 'Vista accesible',
    close: 'Cerrar ventana',
    back: 'Volver a Ayuda',
    retry: 'Volver a intentar',
    reducedMotion: 'Rotación pausada por tu preferencia de movimiento reducido',
    tooltips: {
      home: 'Volver a la vista inicial · Inicio',
      zoomIn: 'Acercar · +',
      zoomOut: 'Alejar · −',
      tilt: 'Cambiar inclinación',
      pauseRotation: 'Pausar rotación',
      playRotation: 'Activar rotación',
      hideBorders: 'Ocultar fronteras',
      showBorders: 'Mostrar fronteras',
      help: 'Ayuda y privacidad',
      demo: 'Explorar los tres países de ejemplo',
    },
    keyboardHint: 'Flechas para girar · + / − para acercar',
    attributionsLabel: 'Fuente de la cartografía',
    cartographyCredit: 'Natural Earth',
    cartographyNote: 'Cartografía simplificada',
    status: {
      loading: 'Preparando el globo',
      ready: 'Globo listo para explorar',
      error: 'El globo no está disponible',
    },
    error: {
      title: 'No se ha podido abrir el globo.',
      description: 'Vuelve a intentarlo o consulta la vista accesible.',
    },
    demoTrigger: '3 países · Ejemplo',
    demo: {
      title: 'Un ejemplo de Atlas',
      intro:
        'España, México y Japón para probar el mapa. Son datos de ejemplo, no un historial personal.',
      toggle: 'Mostrar ejemplo',
      toggleDescription: 'Colorea estos tres países en el globo.',
      selected: 'Ejemplo seleccionado',
      jumpPrefix: 'Ver',
      countries: [
        {
          code: 'ES',
          name: 'España',
          region: 'Europa',
          longitude: -3.7,
          latitude: 40.4,
        },
        {
          code: 'MX',
          name: 'México',
          region: 'América',
          longitude: -102,
          latitude: 23.6,
        },
        {
          code: 'JP',
          name: 'Japón',
          region: 'Asia',
          longitude: 138,
          latitude: 36,
        },
      ],
    },
    helpDialog: {
      title: 'Cómo explorar',
      intro:
        'El globo se mueve despacio y se detiene al tocarlo. Puedes reanudar la rotación con su botón.',
      items: [
        {
          title: 'Ratón',
          description:
            'Arrastra para girar y usa la rueda para acercarte. El botón central permite inclinar la vista.',
        },
        {
          title: 'Pantalla táctil',
          description:
            'Gira con un dedo. Pellizca para acercarte o arrastra con dos dedos para inclinar.',
        },
        {
          title: 'Teclado',
          description:
            'Enfoca el globo y usa las flechas, + y −. Inicio recupera la vista inicial. Tab te lleva a los controles.',
        },
      ],
    },
    privacyDialog: {
      title: 'Tu historial se queda contigo',
      intro:
        'Esta versión solo muestra tres países de ejemplo. No contiene ubicaciones personales ni permite importar un historial.',
      items: [
        {
          title: 'Datos de ejemplo',
          description:
            'España, México y Japón sirven para explorar la interfaz; no representan los viajes de ninguna persona.',
        },
        {
          title: 'La futura importación será local',
          description:
            'El historial original de Timeline se procesará en tu ordenador. Solo se publicarán datos agregados, con zonas de exclusión y sin horas exactas.',
        },
      ],
    },
    accessibleDialog: {
      title: 'Otra forma de explorar',
      intro:
        'Un globo con costas y fronteras simplificadas de Natural Earth. El ejemplo permite recorrer España, México y Japón desde una lista.',
      statusLabel: 'Explorador',
      bordersLabel: 'Fronteras',
      bordersVisible: 'Visibles',
      bordersHidden: 'Ocultas',
      demoLabel: 'Datos mostrados',
      demoVisible: 'Tres países de ejemplo',
      demoHidden: 'Ejemplo oculto',
      motionLabel: 'Movimiento',
      motionActive: 'Rotación suave activada',
      motionPaused: 'Rotación pausada',
      openDemo: 'Abrir países de ejemplo',
    },
  },
} as const;
export const copy = texts.es;
