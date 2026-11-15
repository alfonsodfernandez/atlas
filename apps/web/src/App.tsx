import { useEffect, useRef, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useInterfaceStore } from './store';
import { copy } from './texts';

type IconName = 'arrow' | 'shield' | 'orbit' | 'layers' | 'close';

function Icon({
  name,
  className = '',
}: {
  name: IconName;
  className?: string;
}) {
  const paths: Record<IconName, ReactNode> = {
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    shield: <path d="m12 3 8 3v6c0 5-8 9-8 9S4 17 4 12V6l8-3Zm-4 9 3 3 5-6" />,
    orbit: (
      <>
        <circle cx="12" cy="12" r="7" />
        <ellipse cx="12" cy="12" rx="11" ry="4" transform="rotate(-35 12 12)" />
        <circle cx="18" cy="5" r="1" />
      </>
    ),
    layers: (
      <>
        <path d="m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
  };

  return (
    <svg
      className={className}
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

function OrbitalStudy() {
  return (
    <figure className="orbital-study">
      <div className="orbit-coordinate coordinate-top" aria-hidden="true">
        AXIS / 23.5°
      </div>
      <svg
        className="orbital-art"
        viewBox="0 0 600 600"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="planet-fill" cx=".35" cy=".3" r=".75">
            <stop stopColor="#1b434a" stopOpacity=".8" />
            <stop offset=".55" stopColor="#10242d" />
            <stop offset="1" stopColor="#090f18" />
          </radialGradient>
          <linearGradient
            id="orbit-stroke"
            x1="60"
            y1="190"
            x2="570"
            y2="400"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#7ed0b8" stopOpacity="0" />
            <stop offset=".45" stopColor="#a2e5ce" stopOpacity=".85" />
            <stop offset="1" stopColor="#7ed0b8" stopOpacity=".05" />
          </linearGradient>
          <radialGradient id="halo">
            <stop offset=".65" stopColor="#77c7b4" stopOpacity=".1" />
            <stop offset="1" stopColor="#77c7b4" stopOpacity="0" />
          </radialGradient>
          <clipPath id="planet-clip">
            <circle cx="300" cy="300" r="177" />
          </clipPath>
        </defs>
        <circle cx="300" cy="300" r="260" fill="url(#halo)" />
        <circle
          cx="300"
          cy="300"
          r="245"
          stroke="#73929c"
          strokeOpacity=".12"
          strokeDasharray="2 8"
        />
        <circle
          cx="300"
          cy="300"
          r="214"
          stroke="#73929c"
          strokeOpacity=".09"
        />
        <path
          d="M300 42v19m0 478v19M42 300h19m478 0h19"
          stroke="#79939a"
          strokeOpacity=".45"
        />
        <ellipse
          cx="300"
          cy="300"
          rx="280"
          ry="91"
          transform="rotate(-28 300 300)"
          stroke="#7daca8"
          strokeOpacity=".12"
        />
        <circle
          cx="300"
          cy="300"
          r="177"
          fill="url(#planet-fill)"
          stroke="#91d4c5"
          strokeOpacity=".32"
        />
        <g
          clipPath="url(#planet-clip)"
          stroke="#91cbbb"
          strokeOpacity=".2"
          strokeWidth=".7"
          transform="rotate(-17 300 300)"
        >
          <ellipse cx="300" cy="300" rx="55" ry="177" />
          <ellipse cx="300" cy="300" rx="108" ry="177" />
          <ellipse cx="300" cy="300" rx="150" ry="177" />
          <ellipse cx="300" cy="300" rx="177" ry="45" />
          <ellipse cx="300" cy="300" rx="177" ry="98" />
          <ellipse cx="300" cy="300" rx="177" ry="145" />
          <path d="M123 300h354M300 123v354" />
          <path
            d="m205 189 24 13 9 24 32 8 4 25-21 15-6 33-28 8-15-29-25-15 10-34-11-21 27-27Zm50 137 32 8 15 27-7 30-26 40-12-25 4-26-18-28 12-26Zm81-141 26 12 39-1 27 23-11 20 20 18-13 22-31-4-15 23-24-11-21-35-23 3-10-23 13-20 23-7Zm22 117 30 5 22 34-12 34-24 28-23-20-7-35 14-46Zm65 90 25-8 18 16-14 16-29-5v-19Z"
            fill="#67b59f"
            fillOpacity=".1"
            strokeOpacity=".42"
            strokeLinejoin="round"
          />
        </g>
        <path
          d="M52 397c35 48 172 26 305-44s221-159 186-207"
          stroke="url(#orbit-stroke)"
          strokeWidth="1.5"
        />
        <path
          d="M150 201c31-49 122-86 185-55"
          stroke="#b4edd6"
          strokeOpacity=".4"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <circle cx="444" cy="289" r="4" fill="#b8efd8" />
        <circle cx="444" cy="289" r="10" stroke="#b8efd8" strokeOpacity=".3" />
        <circle cx="95" cy="156" r="1.5" fill="#b0c3c6" />
        <circle cx="494" cy="112" r="2" fill="#86b7ac" />
        <circle cx="501" cy="449" r="1.5" fill="#b0c3c6" />
        <circle cx="126" cy="468" r="2" fill="#86b7ac" />
        <path d="M236 505h128" stroke="#6c8d91" strokeOpacity=".2" />
      </svg>
      <div className="orbit-coordinate coordinate-bottom" aria-hidden="true">
        WGS84 / {copy.artwork}
      </div>
      <figcaption>{copy.artworkCaption}</figcaption>
    </figure>
  );
}

function PrivacyDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const open = useInterfaceStore((state) => state.privacyOpen);
  const setOpen = useInterfaceStore((state) => state.setPrivacyOpen);

  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className="privacy-dialog"
      aria-labelledby="privacy-title"
      onCancel={() => setOpen(false)}
      onClose={() => setOpen(false)}
    >
      <div className="dialog-content">
        <button
          className="dialog-close"
          onClick={() => setOpen(false)}
          aria-label={copy.privacyDialog.closeLabel}
        >
          <Icon name="close" />
        </button>
        <div className="principle-icon">
          <Icon name="shield" />
        </div>
        <p className="eyebrow">{copy.privacyDialog.eyebrow}</p>
        <h2 id="privacy-title">{copy.privacyDialog.title}</h2>
        <p className="dialog-intro">{copy.privacyDialog.intro}</p>
        <ul className="privacy-items">
          {copy.privacyDialog.items.map((item) => (
            <li key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </li>
          ))}
        </ul>
        <button className="primary-button" onClick={() => setOpen(false)}>
          {copy.privacyDialog.close}
        </button>
      </div>
    </dialog>
  );
}

export function App() {
  const reducedMotion = useReducedMotion();
  const selectedPhase = useInterfaceStore((state) => state.selectedPhase);
  const selectPhase = useInterfaceStore((state) => state.selectPhase);
  const setPrivacyOpen = useInterfaceStore((state) => state.setPrivacyOpen);
  const phase = copy.phases[selectedPhase] ?? copy.phases[1];

  return (
    <>
      <a className="skip-link" href="#contenido">
        {copy.skip}
      </a>
      <div className="site-shell">
        <header className="site-header">
          <a className="brand" href="#contenido" aria-label="Atlas, inicio">
            <Icon name="orbit" />
            <span>ATLAS</span>
          </a>
          <nav aria-label="Navegación principal">
            <a href="#proyecto">{copy.project}</a>
            <a href="#hoja-de-ruta">{copy.roadmap}</a>
            <button onClick={() => setPrivacyOpen(true)}>
              {copy.privacy}
              <Icon name="shield" />
            </button>
          </nav>
        </header>

        <main id="contenido">
          <section className="hero" aria-labelledby="hero-title">
            <motion.div
              className="hero-copy"
              initial={reducedMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65 }}
            >
              <p className="eyebrow hero-eyebrow">
                <span />
                {copy.eyebrow}
              </p>
              <h1 id="hero-title">
                {copy.title[0]}
                <br />
                <span>{copy.title[1]}</span>
              </h1>
              <p className="hero-description">{copy.intro}</p>
              <div className="hero-actions">
                <a className="primary-button" href="#hoja-de-ruta">
                  {copy.planAction}
                  <Icon name="arrow" />
                </a>
                <button
                  className="text-button"
                  onClick={() => setPrivacyOpen(true)}
                >
                  <Icon name="shield" />
                  {copy.privacyAction}
                </button>
              </div>
              <div className="project-status">
                <span className="status-dot" />
                <span>{copy.status}</span>
                <span className="status-divider" />
                <span>2026</span>
              </div>
            </motion.div>
            <OrbitalStudy />
          </section>

          <div className="build-status">
            <div className="build-mark" aria-hidden="true">
              00<span>/07</span>
            </div>
            <div>
              <p>{copy.progress}</p>
              <span>{copy.progressDescription}</span>
            </div>
            <div
              className="build-track"
              aria-label="Una de ocho fases preparada"
            >
              <span />
            </div>
            <span className="build-next" aria-hidden="true">
              01 <Icon name="arrow" />
            </span>
          </div>

          <section
            className="principles-section"
            id="proyecto"
            aria-labelledby="principles-title"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">{copy.principlesLabel}</p>
                <h2 id="principles-title">{copy.principlesTitle}</h2>
              </div>
              <p>{copy.principlesIntro}</p>
            </div>
            <div className="principles-grid">
              {copy.principles.map((item) => (
                <article className="principle-card" key={item.title}>
                  <div className="principle-icon">
                    <Icon name={item.icon} />
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section
            className="roadmap-section"
            id="hoja-de-ruta"
            aria-labelledby="roadmap-title"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">{copy.roadmapLabel}</p>
                <h2 id="roadmap-title">{copy.roadmapTitle}</h2>
              </div>
              <p>{copy.roadmapIntro}</p>
            </div>
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
                    {index === 0 && (
                      <span className="phase-check" aria-label="preparada">
                        ✓
                      </span>
                    )}
                  </span>
                  <span className="phase-title">{item.title}</span>
                  <span className="phase-state">
                    {index === 0
                      ? copy.phaseReady
                      : index === 1
                        ? copy.phaseNext
                        : copy.phaseFuture}
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
              <div>
                <span className="eyebrow">
                  {copy.phaseLabel} {String(selectedPhase).padStart(2, '0')}
                </span>
                <h3>{phase.subtitle}</h3>
              </div>
              <p>{phase.description}</p>
              <Icon name={selectedPhase === 0 ? 'layers' : 'orbit'} />
            </div>
          </section>
        </main>

        <footer className="site-footer">
          <div className="footer-brand">
            ATLAS<span>{copy.tagline}</span>
          </div>
          <p>{copy.footer}</p>
          <span>{copy.footerVersion}</span>
        </footer>
      </div>
      <PrivacyDialog />
    </>
  );
}
