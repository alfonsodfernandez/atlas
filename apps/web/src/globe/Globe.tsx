import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import {
  Cartesian2,
  Cartesian3,
  ClockStep,
  Color,
  ConstantProperty,
  Credit,
  Ellipsoid,
  EllipsoidTerrainProvider,
  GeoJsonDataSource,
  HeadingPitchRange,
  Ion,
  Math as CesiumMath,
  Matrix4,
  PerspectiveFrustum,
  ScreenSpaceEventType,
  SingleTileImageryProvider,
  Viewer,
  createGooglePhotorealistic3DTileset,
  createWorldImageryAsync,
  createWorldTerrainAsync,
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import type { GlobeHandle, GlobeProps, GlobeStatus } from './types';

const HOME_LONGITUDE = -15;
const HOME_LATITUDE = 25;
const MINIMUM_HEIGHT = 300;
const MAXIMUM_HEIGHT = 60_000_000;
const ROTATION_RADIANS_PER_SECOND = CesiumMath.toRadians(0.65);
const NASA_CREDIT =
  'NASA/Goddard Scientific Visualization Studio · Blue Marble Next Generation';

function initialStatus(): GlobeStatus {
  return {
    state: 'loading',
    countryCount: 0,
    terrain: 'ellipsoid',
    photorealistic: false,
  };
}

/** Fit the Earth inside the shortest viewport dimension, also on portrait screens. */
function homeHeight(viewer: Viewer): number {
  const aspect =
    viewer.canvas.clientWidth / Math.max(viewer.canvas.clientHeight, 1);
  const frustum = viewer.camera.frustum;
  const verticalField =
    frustum instanceof PerspectiveFrustum
      ? (frustum.fovy ?? CesiumMath.toRadians(50))
      : CesiumMath.toRadians(50);
  const horizontalField = 2 * Math.atan(Math.tan(verticalField / 2) * aspect);
  const halfField = Math.max(Math.min(verticalField, horizontalField) / 2, 0.1);
  const radius = Ellipsoid.WGS84.maximumRadius;
  return Math.min(
    (radius / Math.sin(halfField)) * 1.08 - radius,
    MAXIMUM_HEIGHT,
  );
}

function setHome(
  viewer: Viewer,
  reducedMotion: boolean,
  initial = false,
): void {
  const destination = Cartesian3.fromDegrees(
    HOME_LONGITUDE,
    HOME_LATITUDE,
    homeHeight(viewer),
  );
  const orientation = { heading: 0, pitch: -CesiumMath.PI_OVER_TWO, roll: 0 };
  viewer.camera.cancelFlight();
  if (initial || reducedMotion) {
    viewer.camera.setView({ destination, orientation });
  } else {
    viewer.camera.flyTo({ destination, orientation, duration: 1.4 });
  }
  viewer.scene.requestRender();
}

/** Describe the current pose, independently of the next scheduled WebGL frame. */
function describeCamera(viewer: Viewer, element: HTMLElement | null): void {
  if (!element || viewer.isDestroyed()) return;
  const position = viewer.camera.positionCartographic;
  element.dataset.cameraHeight = position.height.toFixed(2);
  element.dataset.cameraLongitude = CesiumMath.toDegrees(
    position.longitude,
  ).toFixed(5);
  element.dataset.cameraLatitude = CesiumMath.toDegrees(
    position.latitude,
  ).toFixed(5);
  element.dataset.cameraPitch = CesiumMath.toDegrees(
    viewer.camera.pitch,
  ).toFixed(2);
}

/** The module is lazy-loaded by the shell; no Cesium work happens until mounted. */
const Globe = forwardRef<GlobeHandle, GlobeProps>(function Globe(props, ref) {
  const container = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const countriesRef = useRef<GeoJsonDataSource | null>(null);
  const propsRef = useRef(props);

  useEffect(() => {
    propsRef.current = props;
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    viewer.scene.globe.enableLighting = props.lighting;
    if (countriesRef.current)
      countriesRef.current.show = props.countriesVisible;
    viewer.scene.requestRender();
  }, [props]);

  useImperativeHandle(ref, () => {
    const act = (action: (viewer: Viewer) => void): void => {
      const viewer = viewerRef.current;
      if (!viewer || viewer.isDestroyed()) return;
      propsRef.current.onInteraction();
      viewer.camera.cancelFlight();
      action(viewer);
      // Camera actions are synchronous even when geometry delays the render loop.
      describeCamera(viewer, container.current);
      viewer.scene.requestRender();
    };
    return {
      home: () =>
        act((viewer) => setHome(viewer, propsRef.current.reducedMotion)),
      zoomIn: () =>
        act((viewer) => {
          const height = viewer.camera.positionCartographic.height;
          const amount = Math.max(
            0,
            Math.min(height * 0.25, height - MINIMUM_HEIGHT),
          );
          viewer.camera.zoomIn(amount);
        }),
      zoomOut: () =>
        act((viewer) => {
          const height = viewer.camera.positionCartographic.height;
          const amount = Math.max(
            0,
            Math.min(Math.max(height * 0.35, 1_000), MAXIMUM_HEIGHT - height),
          );
          viewer.camera.zoomOut(amount);
        }),
      rotate: (direction) =>
        act((viewer) => {
          if (Math.abs(direction) === 2) {
            viewer.camera.rotateUp(
              -Math.sign(direction) * CesiumMath.toRadians(7),
            );
          } else {
            viewer.camera.rotate(
              Cartesian3.UNIT_Z,
              direction * CesiumMath.toRadians(7),
            );
          }
        }),
      tilt: () =>
        act((viewer) => {
          const target =
            viewer.camera.pickEllipsoid(
              new Cartesian2(
                viewer.canvas.clientWidth / 2,
                viewer.canvas.clientHeight / 2,
              ),
            ) ?? Cartesian3.fromDegrees(HOME_LONGITUDE, HOME_LATITUDE);
          const range = Cartesian3.distance(viewer.camera.positionWC, target);
          const pitch =
            viewer.camera.pitch < CesiumMath.toRadians(-70)
              ? CesiumMath.toRadians(-45)
              : -CesiumMath.PI_OVER_TWO;
          viewer.camera.lookAt(
            target,
            new HeadingPitchRange(viewer.camera.heading, pitch, range),
          );
          viewer.camera.lookAtTransform(Matrix4.IDENTITY);
        }),
    };
  }, []);

  useEffect(() => {
    const element = container.current;
    if (!element) return;

    let active = true;
    let viewer: Viewer | undefined;
    let status = initialStatus();
    const abort = new AbortController();
    const cleanups: Array<() => void> = [];

    const report = (patch: Partial<GlobeStatus>): void => {
      if (!active) return;
      status = { ...status, ...patch };
      element.dataset.engineState = status.state;
      element.dataset.countryCount = String(status.countryCount);
      propsRef.current.onStatus(status);
    };

    const updateCameraDescription = (): void => {
      if (viewer) describeCamera(viewer, element);
    };

    const loadCountries = async (current: Viewer): Promise<void> => {
      try {
        const response = await fetch(
          `${import.meta.env.BASE_URL}maps/countries.geojson`,
          {
            signal: abort.signal,
          },
        );
        if (!response.ok) throw new Error('Unavailable map asset');
        const document: unknown = await response.json();
        if (
          typeof document !== 'object' ||
          document === null ||
          !('features' in document) ||
          !Array.isArray(document.features)
        ) {
          throw new Error('Invalid map asset');
        }
        const featureCount = document.features.length;
        const dataSource = await GeoJsonDataSource.load(document, {
          stroke: Color.fromCssColorString('#9edfc8').withAlpha(0.45),
          strokeWidth: 1,
          fill: Color.TRANSPARENT,
          clampToGround: false,
          credit: new Credit(
            'Fronteras: Natural Earth · dominio público',
            true,
          ),
        });
        if (!active || current.isDestroyed()) return;
        // Only outlines: these polygons never represent visited countries.
        for (const entity of dataSource.entities.values) {
          if (entity.polygon) {
            entity.polygon.fill = new ConstantProperty(false);
            entity.polygon.height = new ConstantProperty(500);
          }
        }
        dataSource.show = propsRef.current.countriesVisible;
        countriesRef.current = dataSource;
        await current.dataSources.add(dataSource);
        if (!active || current.isDestroyed()) return;
        report({ countryCount: featureCount });
        current.scene.requestRender();
      } catch {
        if (!active) return;
        report({
          message:
            'No se pudieron cargar las fronteras. Puedes seguir explorando la Tierra.',
        });
      }
    };

    const loadOptionalServices = (current: Viewer): void => {
      const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN as
        string | undefined;
      const googleKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as
        string | undefined;

      if (ionToken?.trim()) {
        void createWorldImageryAsync()
          .then((imagery) => {
            if (!active || current.isDestroyed()) return;
            cleanups.push(
              imagery.errorEvent.addEventListener(() => {
                // Keep NASA underneath and suppress provider errors containing URLs.
                queueMicrotask(() => {
                  if (
                    !active ||
                    current.isDestroyed() ||
                    !current.imageryLayers.contains(layer)
                  )
                    return;
                  current.imageryLayers.remove(layer);
                  report({
                    message:
                      'Las imágenes opcionales no están disponibles. Se mantiene la imagen NASA.',
                  });
                  current.scene.requestRender();
                });
              }),
            );
            const layer = current.imageryLayers.addImageryProvider(imagery);
            current.scene.requestRender();
          })
          .catch(() => {
            if (active) {
              report({
                message:
                  'Las imágenes opcionales no están disponibles. Se mantiene la imagen NASA.',
              });
            }
          });

        void createWorldTerrainAsync({ requestVertexNormals: true })
          .then((terrain) => {
            if (!active || current.isDestroyed()) return;
            cleanups.push(
              terrain.errorEvent.addEventListener(() => {
                // A listener also prevents Cesium logging URLs containing access tokens.
                queueMicrotask(() => {
                  if (!active || current.isDestroyed()) return;
                  current.terrainProvider = new EllipsoidTerrainProvider();
                  report({
                    terrain: 'ellipsoid',
                    message:
                      'El relieve opcional no está disponible. Se mantiene el globo base.',
                  });
                  current.scene.requestRender();
                });
              }),
            );
            current.terrainProvider = terrain;
            report({ terrain: 'world' });
            current.scene.requestRender();
          })
          .catch(() => {
            if (active) {
              report({
                message:
                  'El relieve opcional no está disponible. Se mantiene el globo base.',
              });
            }
          });
      }

      if (googleKey?.trim()) {
        void createGooglePhotorealistic3DTileset(
          { key: googleKey, onlyUsingWithGoogleGeocoder: true },
          {
            cacheBytes: 64 * 1024 * 1024,
            maximumCacheOverflowBytes: 32 * 1024 * 1024,
          },
        )
          .then((tileset) => {
            if (!active || current.isDestroyed()) {
              tileset.destroy();
              return;
            }
            cleanups.push(
              tileset.tileFailed.addEventListener(() => {
                queueMicrotask(() => {
                  if (!active || current.isDestroyed() || tileset.isDestroyed())
                    return;
                  current.scene.globe.show = true;
                  current.scene.primitives.remove(tileset);
                  report({
                    photorealistic: false,
                    message:
                      'El detalle 3D opcional no está disponible. Se mantiene el mapa base.',
                  });
                  current.scene.requestRender();
                });
              }),
            );
            cleanups.push(
              tileset.initialTilesLoaded.addEventListener(() => {
                if (!active || current.isDestroyed() || tileset.isDestroyed())
                  return;
                // Keep the proven base map visible until the optional replacement
                // actually has content, rather than exposing a blank Earth.
                current.scene.globe.show = false;
                report({ photorealistic: true });
                current.scene.requestRender();
              }),
            );
            current.scene.primitives.add(tileset);
            current.scene.requestRender();
          })
          .catch(() => {
            if (active) {
              report({
                message:
                  'El detalle 3D opcional no está disponible. Se mantiene el mapa base.',
              });
            }
          });
      }
    };

    report(status);
    try {
      // Cesium ships a demonstration token. Never use it implicitly.
      Ion.defaultAccessToken =
        (import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined) ?? '';
      viewer = new Viewer(element, {
        animation: false,
        baseLayerPicker: false,
        baseLayer: false,
        fullscreenButton: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        navigationHelpButton: false,
        sceneModePicker: false,
        selectionIndicator: false,
        timeline: false,
        vrButton: false,
        scene3DOnly: true,
        terrainProvider: new EllipsoidTerrainProvider(),
        showRenderLoopErrors: false,
        useBrowserRecommendedResolution: true,
        requestRenderMode: true,
        maximumRenderTimeChange: Infinity,
        automaticallyTrackDataSourceClocks: false,
        shadows: false,
        msaaSamples: 2,
      });
      viewerRef.current = viewer;
      const current = viewer;
      const { scene, camera, canvas } = current;
      canvas.setAttribute('aria-label', 'Globo terráqueo 3D de Atlas');
      canvas.setAttribute('tabindex', '-1');
      camera.percentageChanged = 0.005;
      current.clock.clockStep = ClockStep.SYSTEM_CLOCK;
      scene.globe.baseColor = Color.fromCssColorString('#10252e');
      scene.globe.enableLighting = propsRef.current.lighting;
      scene.globe.dynamicAtmosphereLighting = true;
      scene.globe.dynamicAtmosphereLightingFromSun = true;
      scene.globe.lightingFadeOutDistance = 100_000;
      scene.globe.lightingFadeInDistance = 300_000;
      scene.screenSpaceCameraController.minimumZoomDistance = MINIMUM_HEIGHT;
      scene.screenSpaceCameraController.maximumZoomDistance = MAXIMUM_HEIGHT;
      current.screenSpaceEventHandler.removeInputAction(
        ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
      );
      cleanups.push(camera.changed.addEventListener(updateCameraDescription));
      cleanups.push(camera.moveEnd.addEventListener(updateCameraDescription));
      setHome(current, true, true);
      updateCameraDescription();

      const interact = (): void => propsRef.current.onInteraction();
      canvas.addEventListener('pointerdown', interact, { passive: true });
      canvas.addEventListener('wheel', interact, { passive: true });
      cleanups.push(() => canvas.removeEventListener('pointerdown', interact));
      cleanups.push(() => canvas.removeEventListener('wheel', interact));

      const contextLost = (event: Event): void => {
        event.preventDefault();
        current.useDefaultRenderLoop = false;
        report({
          state: 'error',
          message:
            'Se ha interrumpido el renderizado 3D. Puedes volver a intentarlo.',
        });
      };
      canvas.addEventListener('webglcontextlost', contextLost);
      cleanups.push(() =>
        canvas.removeEventListener('webglcontextlost', contextLost),
      );
      cleanups.push(
        scene.renderError.addEventListener(() => {
          report({
            state: 'error',
            message:
              'Este dispositivo no ha podido renderizar el globo. Puedes volver a intentarlo.',
          });
        }),
      );

      let lastTick = performance.now();
      cleanups.push(
        current.clock.onTick.addEventListener(() => {
          const now = performance.now();
          const delta = Math.min((now - lastTick) / 1_000, 0.1);
          lastTick = now;
          const settings = propsRef.current;
          if (
            settings.autoRotate &&
            !settings.reducedMotion &&
            !document.hidden
          ) {
            camera.rotate(
              Cartesian3.UNIT_Z,
              ROTATION_RADIANS_PER_SECOND * delta,
            );
            scene.requestRender();
          }
        }),
      );

      // Keep solar lighting current while an idle, non-rotating globe renders on demand.
      const solarTimer = window.setInterval(() => {
        if (active && !current.isDestroyed() && !document.hidden)
          scene.requestRender();
      }, 30_000);
      cleanups.push(() => window.clearInterval(solarTimer));
      const resize = new ResizeObserver(() => {
        if (!active || current.isDestroyed()) return;
        current.resize();
        scene.requestRender();
      });
      resize.observe(element);
      cleanups.push(() => resize.disconnect());

      void SingleTileImageryProvider.fromUrl(
        `${import.meta.env.BASE_URL}maps/earth.jpg`,
        {
          credit: new Credit(NASA_CREDIT, true),
          ellipsoid: Ellipsoid.WGS84,
        },
      )
        .then((imagery) => {
          if (!active || current.isDestroyed()) return;
          cleanups.push(
            imagery.errorEvent.addEventListener(() => {
              report({
                message: 'La imagen base no se ha cargado completamente.',
              });
            }),
          );
          current.imageryLayers.addImageryProvider(imagery);
          const removeReady = scene.postRender.addEventListener(() => {
            if (!active || !scene.globe.tilesLoaded) return;
            removeReady();
            report({ state: 'ready' });
            void loadCountries(current);
            loadOptionalServices(current);
          });
          cleanups.push(removeReady);
          scene.requestRender();
        })
        .catch(() => {
          report({
            state: 'error',
            message:
              'No se pudo cargar la imagen de la Tierra. Puedes volver a intentarlo.',
          });
        });
    } catch {
      report({
        state: 'error',
        message:
          'El globo necesita WebGL 2. Prueba con un navegador actualizado o usa la información accesible.',
      });
    }

    return () => {
      active = false;
      abort.abort();
      for (const cleanup of cleanups) cleanup();
      countriesRef.current = null;
      viewerRef.current = null;
      if (viewer && !viewer.isDestroyed()) viewer.destroy();
      element.replaceChildren();
    };
  }, []);

  return (
    <div ref={container} className="cesium-stage" data-testid="cesium-globe" />
  );
});

export default Globe;
