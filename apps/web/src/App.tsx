import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { GlobeHandle } from './globe/types';
import { useInterfaceStore, type DialogKind } from './store';
import { copy } from './texts';

const Globe = lazy(() => import('./globe/Globe'));

type IconName =
  | 'orbit'
  | 'shield'
  | 'arrow'
  | 'close'
  | 'home'
  | 'plus'
  | 'minus'
  | 'tilt'
  | 'rotate'
  | 'pause'
  | 'layers'
  | 'sun'
  | 'help'
  | 'list';

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    orbit: (
      <>
        <circle cx="12" cy="12" r="7" />
        <ellipse cx="12" cy="12" rx="11" ry="4" transform="rotate(-35 12 12)" />
        <circle cx="18" cy="5" r="1" />
      </>
    ),
    shield: <path d="m12 3 8 3v6c0 5-8 9-8 9S4 17 4 12V6l8-3Zm-4 9 3 3 5-6" />,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    home: (
      <>
        <circle cx="12" cy="12" r="7" />
        <path d="M12 2v5m0 10v5M2 12h5m10 0h5" />
      </>
    ),
    plus: <path d="M5 12h14M12 5v14" />,
    minus: <path d="M5 12h14" />,
    tilt: (
      <>
        <ellipse cx="12" cy="15" rx="9" ry="4" transform="rotate(-20 12 15)" />
        <path d="m8 4 4-2 4 2M12 2v9" />
      </>
    ),
    rotate: (
      <>
        <path d="M20 10a8 8 0 1 0-2 8M20 4v6h-6" />
      </>
    ),
    pause: <path d="M9 5v14M15 5v14" />,
    layers: (
      <path d="m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5" />
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
      </>
    ),
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v.1" />
      </>
    ),
    list: (
      <>
        <path d="M9 6h12M9 12h12M9 18h12M3 6h.1M3 12h.1M3 18h.1" />
      </>
    ),
  };
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

class GlobeBoundary extends Component<
  PropsWithChildren<{ onError: () => void }>,
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function ProjectContent() {
  const selectedPhase = useInterfaceStore((state) => state.selectedPhase);
  const selectPhase = useInterfaceStore((state) => state.selectPhase);
  const phase = copy.phases[selectedPhase] ?? copy.phases[1];
  return (
    <>
      <p className="dialog-intro">{copy.projectDialog.intro}</p>
      <div className="phase-grid" aria-label="Fases del proyecto">
        {copy.phases.map((item, index) => (
          <button
            key={item.title}
            className={`phase-button ${selectedPhase === index ? 'selected' : ''}`}
            aria-pressed={selectedPhase === index}
            aria-controls="phase-detail"
            onClick={() => selectPhase(index)}
          >
            <span className="phase-number">
              {String(index).padStart(2, '0')}
            </span>
            <span className="phase-title">{item.title}</span>
            <span className="phase-state">
              {index === 0
                ? copy.projectDialog.ready
                : index === 1
                  ? copy.projectDialog.current
                  : copy.projectDialog.future}
            </span>
          </button>
        ))}
      </div>
      <div
        id="phase-detail"
        className="phase-detail"
        aria-live="polite"
        aria-atomic="true"
      >
        <h3>{phase.subtitle}</h3>
        <p>{phase.description}</p>
      </div>
    </>
  );
}

function AccessibleContent() {
  const setDialog = useInterfaceStore((state) => state.setDialog);
  const status = useInterfaceStore((state) => state.globeStatus);
  return (
    <>
      <p className="dialog-intro">{copy.accessibleDialog.intro}</p>
      <dl className="accessible-summary">
        <div>
          <dt>Explorador</dt>
          <dd>{copy.status[status.state]}</dd>
        </div>
        <div>
          <dt>Capa de fronteras</dt>
          <dd>
            {status.countryCount > 0
              ? `${status.countryCount} territorios disponibles`
              : 'Todavía no está disponible'}
          </dd>
        </div>
        <div>
          <dt>Datos personales</dt>
          <dd>No se ha cargado ningún historial</dd>
        </div>
      </dl>
      <h3>{copy.accessibleDialog.controls}</h3>
      <p>{copy.accessibleDialog.controlsDescription}</p>
      <h3>{copy.accessibleDialog.next}</h3>
      <p>{copy.accessibleDialog.nextDescription}</p>
      <button className="text-button" onClick={() => setDialog('project')}>
        {copy.accessibleDialog.projectAction}
        <Icon name="arrow" />
      </button>
    </>
  );
}

function InfoDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const activeDialog = useInterfaceStore((state) => state.activeDialog);
  const setDialog = useInterfaceStore((state) => state.setDialog);
  const kind = activeDialog ?? 'privacy';
  const content =
    kind === 'privacy'
      ? copy.privacyDialog
      : kind === 'project'
        ? copy.projectDialog
        : kind === 'accessible'
          ? copy.accessibleDialog
          : copy.helpDialog;

  useEffect(() => {
    if (activeDialog !== null && !dialog.current?.open)
      dialog.current?.showModal();
    else if (activeDialog !== null) {
      dialog.current?.querySelector<HTMLElement>('#dialog-title')?.focus();
    }
    if (activeDialog === null && dialog.current?.open) dialog.current.close();
  }, [activeDialog]);

  return (
    <dialog
      ref={dialog}
      className={`info-dialog ${kind === 'project' ? 'project-dialog' : ''}`}
      aria-labelledby="dialog-title"
      onCancel={(event) => {
        // A queued native close event must never overwrite a later opening.
        event.preventDefault();
        setDialog(null);
      }}
    >
      <div className="dialog-content">
        <button
          className="dialog-close icon-button"
          aria-label={copy.close}
          onClick={() => setDialog(null)}
        >
          <Icon name="close" />
        </button>
        <div className="dialog-symbol">
          <Icon
            name={
              kind === 'privacy'
                ? 'shield'
                : kind === 'accessible'
                  ? 'list'
                  : kind === 'help'
                    ? 'help'
                    : 'orbit'
            }
          />
        </div>
        <p className="eyebrow">{content.eyebrow}</p>
        <h2 id="dialog-title" tabIndex={-1}>
          {content.title}
        </h2>
        {kind === 'project' ? (
          <ProjectContent />
        ) : kind === 'accessible' ? (
          <AccessibleContent />
        ) : (
          <>
            <p className="dialog-intro">
              {kind === 'privacy'
                ? copy.privacyDialog.intro
                : copy.helpDialog.intro}
            </p>
            <ul className="dialog-items">
              {(kind === 'privacy'
                ? copy.privacyDialog.items
                : copy.helpDialog.items
              ).map((item) => (
                <li key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </li>
              ))}
            </ul>
          </>
        )}
        <button
          className="primary-button dialog-done"
          onClick={() => setDialog(null)}
        >
          {copy.understood}
        </button>
      </div>
    </dialog>
  );
}

export function App() {
  const motionPreference = useReducedMotion();
  // Stay still until the browser has resolved the motion preference.
  const reducedMotion = motionPreference !== false;
  const globe = useRef<GlobeHandle>(null);
  const autoRotate = useInterfaceStore((state) => state.autoRotate);
  const countriesVisible = useInterfaceStore((state) => state.countriesVisible);
  const lighting = useInterfaceStore((state) => state.lighting);
  const status = useInterfaceStore((state) => state.globeStatus);
  const viewerKey = useInterfaceStore((state) => state.viewerKey);
  const activeDialog = useInterfaceStore((state) => state.activeDialog);
  const toggleRotation = useInterfaceStore((state) => state.toggleRotation);
  const stopRotation = useInterfaceStore((state) => state.stopRotation);
  const toggleCountries = useInterfaceStore((state) => state.toggleCountries);
  const toggleLighting = useInterfaceStore((state) => state.toggleLighting);
  const setGlobeStatus = useInterfaceStore((state) => state.setGlobeStatus);
  const retryGlobe = useInterfaceStore((state) => state.retryGlobe);
  const setDialog = useInterfaceStore((state) => state.setDialog);
  const ready = status.state === 'ready';
  const rotating = autoRotate && !reducedMotion && ready;

  const openDialog = useCallback(
    (kind: DialogKind) => {
      stopRotation();
      setDialog(kind);
    },
    [stopRotation, setDialog],
  );

  const handleLoadError = useCallback(() => {
    setGlobeStatus({
      state: 'error',
      countryCount: 0,
      terrain: 'ellipsoid',
      photorealistic: false,
    });
  }, [setGlobeStatus]);

  const handleKeyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (activeDialog !== null || !ready) return;
    if (
      event.target instanceof HTMLElement &&
      event.target !== event.currentTarget &&
      event.target.closest(
        'a, button, input, textarea, select, [contenteditable="true"]',
      )
    )
      return;
    const controls = globe.current;
    if (!controls) return;
    const action =
      event.key === 'ArrowLeft'
        ? () => controls.rotate(-1)
        : event.key === 'ArrowRight'
          ? () => controls.rotate(1)
          : event.key === 'ArrowUp'
            ? () => controls.rotate(-2)
            : event.key === 'ArrowDown'
              ? () => controls.rotate(2)
              : ['+', '='].includes(event.key)
                ? () => controls.zoomIn()
                : ['-', '−', '_'].includes(event.key)
                  ? () => controls.zoomOut()
                  : event.key === 'Home'
                    ? () => controls.home()
                    : undefined;
    if (!action) return;
    event.preventDefault();
    stopRotation();
    action();
  };

  return (
    <>
      <a className="skip-link" href="#globo">
        {copy.skip}
      </a>
      <div className="atlas-app">
        <header className="site-header">
          <a className="brand" href="#globo" aria-label={copy.brand}>
            <Icon name="orbit" />
            <span>
              ATLAS<small>{copy.tagline}</small>
            </span>
          </a>
          <nav aria-label="Navegación principal">
            <button className="nav-link" onClick={() => openDialog('project')}>
              {copy.project}
            </button>
            <button
              className="nav-link accessible-link"
              onClick={() => openDialog('accessible')}
            >
              <Icon name="list" />
              <span>{copy.accessible}</span>
            </button>
            <button
              className="privacy-link"
              onClick={() => openDialog('privacy')}
            >
              <Icon name="shield" />
              <span>{copy.privacy}</span>
            </button>
          </nav>
        </header>

        <main className="explorer" id="contenido">
          <section
            id="globo"
            className="globe-stage"
            role="region"
            aria-label={copy.globeLabel}
            aria-describedby="globe-instructions"
            tabIndex={0}
            data-globe-state={status.state}
            onKeyDown={handleKeyboard}
            onPointerDown={stopRotation}
            onWheel={stopRotation}
          >
            <div className="globe-viewport">
              <GlobeBoundary key={viewerKey} onError={handleLoadError}>
                <Suspense fallback={null}>
                  <Globe
                    ref={globe}
                    autoRotate={rotating}
                    countriesVisible={countriesVisible}
                    lighting={lighting}
                    reducedMotion={reducedMotion}
                    onInteraction={stopRotation}
                    onStatus={setGlobeStatus}
                  />
                </Suspense>
              </GlobeBoundary>
            </div>
          </section>
          <p id="globe-instructions" className="sr-only">
            {copy.globeInstructions}
          </p>

          <motion.aside
            className="intro-panel"
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            aria-labelledby="hero-title"
          >
            <p className="eyebrow">{copy.eyebrow}</p>
            <h1 id="hero-title">
              {copy.title[0]}
              <br />
              <span>{copy.title[1]}</span>
            </h1>
            <p className="intro-description">{copy.intro}</p>
            <button
              className="text-button"
              onClick={() => openDialog('project')}
            >
              {copy.projectAction}
              <Icon name="arrow" />
            </button>
            <div className="empty-atlas">
              <span className="empty-mark" aria-hidden="true">
                +
              </span>
              <div>
                <p>{copy.emptyLabel}</p>
                <span>{copy.emptyDescription}</span>
              </div>
            </div>
          </motion.aside>

          <div className="map-options" aria-label="Capas del globo">
            <button
              className="option-button"
              aria-pressed={countriesVisible}
              disabled={!ready || status.countryCount === 0}
              onClick={toggleCountries}
            >
              <Icon name="layers" />
              <span>{copy.countries}</span>
              <span className="toggle-indicator" aria-hidden="true" />
            </button>
            <button
              className="option-button"
              aria-pressed={lighting}
              disabled={!ready}
              onClick={toggleLighting}
            >
              <Icon name="sun" />
              <span>{copy.lighting}</span>
              <span className="toggle-indicator" aria-hidden="true" />
            </button>
          </div>

          {status.state === 'loading' && (
            <div className="loading-indicator" aria-hidden="true">
              <span className="loading-orbit" />
              <span>{copy.status.loading}</span>
            </div>
          )}
          {status.state === 'error' && (
            <div className="globe-fallback">
              <div className="fallback-symbol">
                <Icon name="orbit" />
              </div>
              <h2>{copy.fallback.title}</h2>
              <p>{copy.fallback.description}</p>
              <div>
                <button className="primary-button" onClick={retryGlobe}>
                  {copy.fallback.retry}
                </button>
                <button
                  className="secondary-button"
                  onClick={() => openDialog('accessible')}
                >
                  {copy.accessible}
                </button>
              </div>
            </div>
          )}

          <div
            className="camera-controls"
            role="group"
            aria-label="Controles de cámara"
          >
            <button
              className="icon-button"
              disabled={!ready}
              aria-label={copy.home}
              title={copy.home}
              onClick={() => globe.current?.home()}
            >
              <Icon name="home" />
            </button>
            <button
              className="icon-button"
              disabled={!ready || reducedMotion}
              aria-label={copy.rotation}
              title={reducedMotion ? copy.reducedMotion : copy.rotation}
              aria-pressed={rotating}
              onClick={toggleRotation}
            >
              <Icon name={rotating ? 'pause' : 'rotate'} />
            </button>
            <button
              className="icon-button"
              disabled={!ready}
              aria-label={copy.tilt}
              title={copy.tilt}
              onClick={() => globe.current?.tilt()}
            >
              <Icon name="tilt" />
            </button>
            <span className="control-divider" aria-hidden="true" />
            <button
              className="icon-button"
              disabled={!ready}
              aria-label={copy.zoomOut}
              title={copy.zoomOut}
              onClick={() => globe.current?.zoomOut()}
            >
              <Icon name="minus" />
            </button>
            <button
              className="icon-button"
              disabled={!ready}
              aria-label={copy.zoomIn}
              title={copy.zoomIn}
              onClick={() => globe.current?.zoomIn()}
            >
              <Icon name="plus" />
            </button>
          </div>

          <div className="explorer-status">
            <p className="phase-label">{copy.phase}</p>
            <p
              role="status"
              aria-live="polite"
              data-testid="globe-status"
              data-state={status.state}
            >
              <span className={`status-dot ${status.state}`} />
              {copy.status[status.state]}
            </p>
            {status.message && <p className="status-note">{status.message}</p>}
          </div>
          <button
            className="help-button icon-button"
            aria-label={copy.help}
            title={copy.help}
            onClick={() => openDialog('help')}
          >
            <Icon name="help" />
          </button>
          {reducedMotion && <p className="sr-only">{copy.reducedMotion}</p>}
        </main>
        <InfoDialog />
      </div>
    </>
  );
}
