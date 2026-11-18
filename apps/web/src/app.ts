import GlobeRenderer from './globe/GlobeRenderer';
import type { GlobeStatus } from './globe/types';
import { copy } from './texts';

type DialogKind = 'privacy' | 'project' | 'accessible' | 'help';
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
  | 'borders'
  | 'help'
  | 'list';

const iconPaths: Record<IconName, string> = {
  orbit:
    '<circle cx="12" cy="12" r="7"/><ellipse cx="12" cy="12" rx="11" ry="4" transform="rotate(-35 12 12)"/><circle cx="18" cy="5" r="1"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9S4 17 4 12V6l8-3Zm-4 9 3 3 5-6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  home: '<circle cx="12" cy="12" r="7"/><path d="M12 2v5m0 10v5M2 12h5m10 0h5"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  minus: '<path d="M5 12h14"/>',
  tilt: '<ellipse cx="12" cy="15" rx="9" ry="4" transform="rotate(-20 12 15)"/><path d="m8 4 4-2 4 2M12 2v9"/>',
  rotate: '<path d="M20 10a8 8 0 1 0-2 8M20 4v6h-6"/>',
  borders: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16M15 5v16"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v.1"/>',
  list: '<path d="M9 6h12M9 12h12M9 18h12M3 6h.1M3 12h.1M3 18h.1"/>',
};

const icon = (name: IconName): string =>
  `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]}</svg>`;

// Only build-time interface copy enters these templates; runtime messages use textContent.
const escape = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character] ?? character;
  });

function itemList(
  items: readonly { title: string; description: string }[],
): string {
  return `<ul class="dialog-items">${items
    .map(
      (item) =>
        `<li><h3>${escape(item.title)}</h3><p>${escape(item.description)}</p></li>`,
    )
    .join('')}</ul>`;
}

function template(): string {
  const cameraButton = (
    action: string,
    title: string,
    symbol: IconName,
  ): string =>
    `<button class="icon-button" data-camera="${action}" aria-label="${escape(title)}" title="${escape(title)}" disabled>${icon(symbol)}</button>`;
  const phases = copy.phases
    .map(
      (phase, index) =>
        `<button class="phase-button${index === 1 ? ' selected' : ''}" data-phase="${index}" aria-pressed="${index === 1}" aria-controls="phase-detail"><span class="phase-number">${String(index).padStart(2, '0')}</span><span class="phase-title">${escape(phase.title)}</span><span class="phase-state">${escape(index === 0 ? copy.projectDialog.ready : index === 1 ? copy.projectDialog.current : copy.projectDialog.future)}</span></button>`,
    )
    .join('');

  return `
    <a class="skip-link" href="#globo">${escape(copy.skip)}</a>
    <div class="atlas-app">
      <header class="site-header">
        <a class="brand" href="#globo" aria-label="${escape(copy.brand)}">${icon('orbit')}<span>ATLAS<small>${escape(copy.tagline)}</small></span></a>
        <nav class="main-nav" aria-label="${escape(copy.navigationLabel)}">
          <button class="nav-link" data-dialog="project">${escape(copy.project)}</button>
          <button class="nav-link accessible-link" data-dialog="accessible" aria-label="${escape(copy.accessible)}">${icon('list')}<span>${escape(copy.accessible)}</span></button>
          <button class="privacy-link" data-dialog="privacy">${icon('shield')}<span>${escape(copy.privacy)}</span></button>
        </nav>
      </header>
      <main class="explorer" id="contenido">
        <section id="globo" class="globe-stage" role="region" aria-label="${escape(copy.globeLabel)}" aria-describedby="globe-instructions" tabindex="0" data-globe-state="loading">
          <div class="globe-viewport"><div class="native-globe"></div></div>
        </section>
        <p id="globe-instructions" class="sr-only">${escape(copy.globeInstructions)}</p>
        <aside class="intro-panel" aria-labelledby="hero-title">
          <p class="eyebrow">${escape(copy.eyebrow)}</p>
          <h1 id="hero-title">${escape(copy.title[0])}<br><span>${escape(copy.title[1])}</span></h1>
          <p class="intro-description">${escape(copy.intro)}</p>
          <p class="map-note">${escape(copy.emptyDescription)}</p>
        </aside>
        <div class="map-options" aria-label="${escape(copy.layersLabel)}">
          <button class="option-button" data-action="borders" aria-pressed="true" disabled>${icon('borders')}<span>${escape(copy.borders)}</span><span class="toggle-indicator" aria-hidden="true"></span></button>
        </div>
        <div class="loading-indicator" aria-hidden="true"><span class="loading-orbit"></span><span>${escape(copy.status.loading)}</span></div>
        <div class="globe-fallback" hidden>
          <div class="fallback-symbol">${icon('orbit')}</div><h2>${escape(copy.fallback.title)}</h2><p>${escape(copy.fallback.description)}</p>
          <div><button class="primary-button" data-action="retry">${escape(copy.fallback.retry)}</button><button class="secondary-button" data-dialog="accessible">${escape(copy.accessible)}</button></div>
        </div>
        <div class="camera-controls" role="group" aria-label="${escape(copy.cameraControlsLabel)}">
          ${cameraButton('home', copy.home, 'home')}
          <button class="icon-button" data-action="rotation" aria-label="${escape(copy.rotation)}" title="${escape(copy.rotation)}" aria-pressed="false" disabled>${icon('rotate')}</button>
          ${cameraButton('tilt', copy.tilt, 'tilt')}<span class="control-divider" aria-hidden="true"></span>
          ${cameraButton('zoomOut', copy.zoomOut, 'minus')}${cameraButton('zoomIn', copy.zoomIn, 'plus')}
        </div>
        <div class="explorer-status"><p role="status" aria-live="polite" data-testid="globe-status" data-state="loading"><span class="status-dot loading"></span><span class="status-value">${escape(copy.status.loading)}</span></p><p class="status-note" hidden></p></div>
        <button class="help-button icon-button" data-dialog="help" aria-label="${escape(copy.help)}" title="${escape(copy.help)}">${icon('help')}</button>
        <p class="reduced-motion-note sr-only" hidden>${escape(copy.reducedMotion)}</p>
        <footer class="credits" aria-label="${escape(copy.attributionsLabel)}"><a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener noreferrer">${escape(copy.cartographyCredit)}</a><span>${escape(copy.cartographyNote)}</span></footer>
      </main>
      <dialog class="info-dialog" aria-labelledby="dialog-title">
        <div class="dialog-content">
          <button class="dialog-close icon-button" data-action="close-dialog" aria-label="${escape(copy.close)}">${icon('close')}</button>
          <div class="dialog-symbol">${icon('orbit')}</div><p class="eyebrow dialog-eyebrow"></p><h2 id="dialog-title" tabindex="-1"></h2>
          <section data-panel="privacy" hidden><p class="dialog-intro">${escape(copy.privacyDialog.intro)}</p>${itemList(copy.privacyDialog.items)}</section>
          <section data-panel="help" hidden><p class="dialog-intro">${escape(copy.helpDialog.intro)}</p>${itemList(copy.helpDialog.items)}</section>
          <section data-panel="project" hidden><p class="dialog-intro">${escape(copy.projectDialog.intro)}</p><div class="phase-grid" aria-label="${escape(copy.phasesLabel)}">${phases}</div><div id="phase-detail" class="phase-detail" aria-live="polite" aria-atomic="true"><h3></h3><p></p></div></section>
          <section data-panel="accessible" hidden><p class="dialog-intro">${escape(copy.accessibleDialog.intro)}</p><dl class="accessible-summary"><div><dt>${escape(copy.accessibleDialog.explorerLabel)}</dt><dd data-summary="status"></dd></div><div><dt>${escape(copy.accessibleDialog.cartographyLabel)}</dt><dd>${escape(copy.accessibleDialog.cartographyDescription)}</dd></div><div><dt>${escape(copy.accessibleDialog.bordersLabel)}</dt><dd data-summary="borders"></dd></div><div><dt>${escape(copy.accessibleDialog.dataLabel)}</dt><dd>${escape(copy.accessibleDialog.noData)}</dd></div></dl><h3>${escape(copy.accessibleDialog.controls)}</h3><p>${escape(copy.accessibleDialog.controlsDescription)}</p><h3>${escape(copy.accessibleDialog.next)}</h3><p>${escape(copy.accessibleDialog.nextDescription)}</p><button class="text-button" data-dialog="project">${escape(copy.accessibleDialog.projectAction)}${icon('arrow')}</button></section>
          <button class="primary-button dialog-done" data-action="close-dialog">${escape(copy.understood)}</button>
        </div>
      </dialog>
    </div>`;
}

/** Mount the interface once. All interaction updates existing nodes. */
export function mountAtlas(root: HTMLElement): () => void {
  root.innerHTML = template();
  const events = new AbortController();
  const query = <T extends Element>(selector: string): T => {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Elemento de interfaz ausente: ${selector}`);
    return element;
  };
  const setText = (element: Element, value: string): void => {
    if (element.textContent !== value) element.textContent = value;
  };
  const stage = query<HTMLElement>('.globe-stage');
  const host = query<HTMLDivElement>('.native-globe');
  const statusNode = query<HTMLElement>('[data-testid="globe-status"]');
  const statusValue = query<HTMLElement>('.status-value');
  const statusDot = query<HTMLElement>('.status-dot');
  const statusNote = query<HTMLElement>('.status-note');
  const loading = query<HTMLElement>('.loading-indicator');
  const fallback = query<HTMLElement>('.globe-fallback');
  const cameraButtons =
    root.querySelectorAll<HTMLButtonElement>('[data-camera]');
  const rotationButton = query<HTMLButtonElement>('[data-action="rotation"]');
  const bordersButton = query<HTMLButtonElement>('[data-action="borders"]');
  const reducedMotionNote = query<HTMLElement>('.reduced-motion-note');
  const summaryStatus = query<HTMLElement>('[data-summary="status"]');
  const summaryBorders = query<HTMLElement>('[data-summary="borders"]');
  const dialog = query<HTMLDialogElement>('.info-dialog');
  const dialogTitle = query<HTMLHeadingElement>('#dialog-title');
  const dialogEyebrow = query<HTMLElement>('.dialog-eyebrow');
  const panels = root.querySelectorAll<HTMLElement>('[data-panel]');
  const phaseButtons = root.querySelectorAll<HTMLButtonElement>('[data-phase]');
  const phaseTitle = query<HTMLElement>('#phase-detail h3');
  const phaseDescription = query<HTMLElement>('#phase-detail p');
  const motionPreference = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  );
  let reducedMotion = motionPreference.matches;
  let autoRotate = false;
  let bordersVisible = true;
  let activeDialog: DialogKind | null = null;
  let returnFocus: HTMLElement | null = null;
  let renderer: GlobeRenderer | null = null;
  let generation = 0;
  let disposed = false;
  let status: GlobeStatus = { state: 'loading' };

  const updateControls = (): void => {
    const ready = status.state === 'ready';
    for (const button of cameraButtons) button.disabled = !ready;
    rotationButton.disabled = !ready || reducedMotion;
    rotationButton.setAttribute(
      'aria-pressed',
      String(autoRotate && ready && !reducedMotion),
    );
    rotationButton.title = reducedMotion ? copy.reducedMotion : copy.rotation;
    bordersButton.disabled = !ready;
    bordersButton.setAttribute('aria-pressed', String(bordersVisible));
    setText(
      summaryBorders,
      bordersVisible
        ? copy.accessibleDialog.bordersVisible
        : copy.accessibleDialog.bordersHidden,
    );
    reducedMotionNote.hidden = !reducedMotion;
  };

  const updateStatus = (next: GlobeStatus): void => {
    status = next;
    stage.dataset.globeState = next.state;
    statusNode.dataset.state = next.state;
    statusDot.className = `status-dot ${next.state}`;
    setText(statusValue, copy.status[next.state]);
    setText(statusNote, next.message ?? '');
    statusNote.hidden = !next.message;
    loading.hidden = next.state !== 'loading';
    fallback.hidden = next.state !== 'error';
    setText(summaryStatus, copy.status[next.state]);
    updateControls();
  };

  const stopRotation = (): void => {
    if (!autoRotate) return;
    autoRotate = false;
    renderer?.setAutoRotate(false);
    updateControls();
  };

  const selectPhase = (index: number): void => {
    const phase = copy.phases[index];
    if (!phase) return;
    for (const button of phaseButtons) {
      const selected = Number(button.dataset.phase) === index;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('selected', selected);
    }
    setText(phaseTitle, phase.subtitle);
    setText(phaseDescription, phase.description);
  };

  const openDialog = (kind: DialogKind, trigger?: HTMLElement): void => {
    stopRotation();
    if (!dialog.open) {
      returnFocus =
        trigger ??
        (document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null);
    }
    activeDialog = kind;
    const content =
      kind === 'privacy'
        ? copy.privacyDialog
        : kind === 'project'
          ? copy.projectDialog
          : kind === 'accessible'
            ? copy.accessibleDialog
            : copy.helpDialog;
    setText(dialogTitle, content.title);
    setText(dialogEyebrow, content.eyebrow);
    dialog.classList.toggle('project-dialog', kind === 'project');
    for (const panel of panels) panel.hidden = panel.dataset.panel !== kind;
    if (!dialog.open) dialog.showModal();
    else dialogTitle.focus();
  };

  const closeDialog = (): void => {
    activeDialog = null;
    dialog.close();
    returnFocus?.focus();
    returnFocus = null;
  };

  const initializeGlobe = (): void => {
    if (disposed) return;
    const ownGeneration = ++generation;
    renderer?.destroy();
    renderer = null;
    host.replaceChildren();
    updateStatus({ state: 'loading' });
    try {
      renderer = new GlobeRenderer(host, {
        autoRotate,
        bordersVisible,
        reducedMotion,
        onInteraction: stopRotation,
        onStatus: (next: GlobeStatus) => {
          if (!disposed && generation === ownGeneration) updateStatus(next);
        },
      });
    } catch {
      updateStatus({ state: 'error' });
    }
  };

  root.addEventListener(
    'click',
    (event) => {
      const button =
        event.target instanceof Element
          ? event.target.closest<HTMLButtonElement>('button')
          : null;
      if (!button || button.disabled) return;
      const dialogKind = button.dataset.dialog;
      if (
        dialogKind === 'privacy' ||
        dialogKind === 'project' ||
        dialogKind === 'accessible' ||
        dialogKind === 'help'
      ) {
        openDialog(dialogKind, button);
        return;
      }
      const action = button.dataset.action;
      if (action === 'close-dialog') closeDialog();
      else if (button.dataset.phase !== undefined)
        selectPhase(Number(button.dataset.phase));
      else if (action === 'retry') {
        initializeGlobe();
      } else if (action === 'rotation') {
        autoRotate = !autoRotate;
        renderer?.setAutoRotate(autoRotate);
        updateControls();
      } else if (action === 'borders') {
        stopRotation();
        bordersVisible = !bordersVisible;
        renderer?.setBordersVisible(bordersVisible);
        updateControls();
      } else if (renderer) {
        const command = button.dataset.camera;
        if (
          command === 'home' ||
          command === 'zoomIn' ||
          command === 'zoomOut' ||
          command === 'tilt'
        ) {
          stopRotation();
          renderer[command]();
        }
      }
    },
    { signal: events.signal },
  );

  stage.addEventListener(
    'keydown',
    (event) => {
      if (activeDialog !== null || status.state !== 'ready' || !renderer)
        return;
      if (
        event.target instanceof Element &&
        event.target.closest(
          'a, button, input, textarea, select, [contenteditable="true"]',
        )
      )
        return;
      const key = event.key;
      if (
        ![
          'ArrowLeft',
          'ArrowRight',
          'ArrowUp',
          'ArrowDown',
          '+',
          '=',
          '-',
          '−',
          '_',
          'Home',
        ].includes(key)
      )
        return;
      event.preventDefault();
      stopRotation();
      if (key === 'Home') renderer.home();
      else if (key === '+' || key === '=') renderer.zoomIn();
      else if (key === '-' || key === '−' || key === '_') renderer.zoomOut();
      else
        renderer.rotate(
          key === 'ArrowLeft'
            ? -1
            : key === 'ArrowRight'
              ? 1
              : key === 'ArrowUp'
                ? -2
                : 2,
        );
    },
    { signal: events.signal },
  );

  dialog.addEventListener(
    'cancel',
    (event) => {
      event.preventDefault();
      closeDialog();
    },
    { signal: events.signal },
  );
  motionPreference.addEventListener(
    'change',
    (event) => {
      reducedMotion = event.matches;
      if (reducedMotion) stopRotation();
      renderer?.setReducedMotion(reducedMotion);
      updateControls();
    },
    { signal: events.signal },
  );

  selectPhase(1);
  updateStatus(status);
  initializeGlobe();

  return () => {
    if (disposed) return;
    disposed = true;
    generation += 1;
    events.abort();
    renderer?.destroy();
    renderer = null;
    if (dialog.open) dialog.close();
    root.replaceChildren();
  };
}
