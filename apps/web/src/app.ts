import GlobeRenderer from './globe/GlobeRenderer';
import type { GlobeStatus } from './globe/types';
import { copy } from './texts';

type DialogKind = 'help' | 'privacy' | 'accessible' | 'demo';
type IconName =
  | 'home'
  | 'plus'
  | 'minus'
  | 'tilt'
  | 'rotate'
  | 'pause'
  | 'help'
  | 'close'
  | 'arrow';
const paths: Record<IconName, string> = {
  home: '<circle cx="12" cy="12" r="6.5"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  minus: '<path d="M5 12h14"/>',
  tilt: '<ellipse cx="12" cy="15" rx="8.5" ry="3.5" transform="rotate(-20 12 15)"/><path d="m9 4 3-2 3 2M12 2v8"/>',
  rotate: '<path d="M20 10a8 8 0 1 0-2 8M20 4v6h-6"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v.1"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
};
const icon = (name: IconName): string =>
  `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
const escape = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        character
      ] ?? character,
  );
const items = (
  values: readonly { title: string; description: string }[],
): string =>
  `<dl class="guide-list">${values.map((item) => `<div><dt>${escape(item.title)}</dt><dd>${escape(item.description)}</dd></div>`).join('')}</dl>`;
const cameraButton = (
  action: string,
  label: string,
  tooltip: string,
  symbol: IconName,
): string =>
  `<button class="icon-button" data-camera="${action}" aria-label="${escape(label)}" data-tooltip="${escape(tooltip)}" disabled>${icon(symbol)}</button>`;

function template(): string {
  const countries = copy.demo.countries
    .map(
      (country) =>
        `<button class="country-button" data-country="${country.code}" aria-label="${copy.demo.jumpPrefix} ${escape(country.name)}" disabled><span><strong>${escape(country.name)}</strong><small>${escape(country.region)}</small></span>${icon('arrow')}</button>`,
    )
    .join('');
  return `<a class="skip-link" href="#globo">${escape(copy.skip)}</a>
  <div class="atlas-app">
    <header class="app-header">
      <a class="wordmark" href="#globo" aria-label="${escape(copy.brand)}"><svg viewBox="0 0 137 28" aria-hidden="true"><path d="M2 23 11 3l9 20M5.5 15.5h11M29 4h20M39 4v19M60 4v19h16M85 23l9-20 9 20M88.5 15.5h11M132 6c-4-4-16-4-16 3 0 7 17 2 17 10 0 7-14 7-19 2"/></svg><span class="sr-only">ATLAS</span></a>
      <div class="header-tools"><button class="demo-trigger" data-dialog="demo" aria-label="${escape(copy.demoTrigger)}" data-tooltip="${escape(copy.tooltips.demo)}"><span class="demo-dot" aria-hidden="true"></span><span>3 países</span><span class="demo-badge">Ejemplo</span></button><button class="icon-button help-button" data-dialog="help" aria-label="${escape(copy.help)}" data-tooltip="${escape(copy.tooltips.help)}">${icon('help')}</button></div>
    </header>
    <main class="explorer" id="contenido">
      <h1 class="sr-only">${escape(copy.pageTitle)}</h1>
      <section id="globo" class="globe-stage" role="region" aria-label="${escape(copy.globeLabel)}" aria-describedby="globe-instructions" tabindex="0" data-globe-state="loading"><div class="globe-viewport"><div class="native-globe"></div></div><div class="globe-fallback" hidden><h2>${escape(copy.error.title)}</h2><p class="error-description">${escape(copy.error.description)}</p><div><button class="primary-button" data-action="retry">${escape(copy.retry)}</button><button class="text-button" data-dialog="accessible">${escape(copy.accessible)}</button></div></div></section>
      <p class="sr-only" id="globe-instructions">${escape(copy.globeInstructions)}</p>
      <div class="stage-controls" role="group" aria-label="${escape(copy.controlsLabel)}"><div class="camera-controls">${cameraButton('home', copy.home, copy.tooltips.home, 'home')}<span class="control-divider" aria-hidden="true"></span>${cameraButton('zoomOut', copy.zoomOut, copy.tooltips.zoomOut, 'minus')}${cameraButton('zoomIn', copy.zoomIn, copy.tooltips.zoomIn, 'plus')}${cameraButton('tilt', copy.tilt, copy.tooltips.tilt, 'tilt')}<button class="icon-button" data-action="rotation" aria-label="${escape(copy.rotation)}" aria-pressed="false" data-tooltip="${escape(copy.tooltips.pauseRotation)}" disabled>${icon('pause')}</button></div><button class="border-switch" role="switch" data-action="borders" aria-label="${escape(copy.borders)}" aria-checked="true" data-tooltip="${escape(copy.tooltips.hideBorders)}" disabled><span>${escape(copy.borders)}</span><span class="switch-track" aria-hidden="true"><span></span></span></button></div>
      <div class="sr-only" role="status" aria-live="polite" data-testid="globe-status" data-state="loading">${escape(copy.status.loading)}</div><div class="sr-only" role="status" aria-live="polite" data-testid="selection-status"></div>
    </main>
    <footer class="app-footer"><div class="credits" aria-label="${escape(copy.attributionsLabel)}"><a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener noreferrer">${escape(copy.cartographyCredit)}</a><span>${escape(copy.cartographyNote)}</span></div><span class="keyboard-hint" aria-hidden="true">${escape(copy.keyboardHint)}</span></footer>
    <dialog class="info-dialog" aria-labelledby="dialog-title"><div class="dialog-content"><button class="dialog-close icon-button" data-action="close-dialog" aria-label="${escape(copy.close)}">${icon('close')}</button><h2 id="dialog-title" tabindex="-1"></h2>
      <section data-panel="help" hidden><p class="dialog-intro">${escape(copy.helpDialog.intro)}</p>${items(copy.helpDialog.items)}<nav class="help-links" aria-label="${escape(copy.help)}"><button class="text-button" data-dialog="privacy">${escape(copy.privacy)}${icon('arrow')}</button><button class="text-button" data-dialog="accessible">${escape(copy.accessible)}${icon('arrow')}</button></nav></section>
      <section data-panel="privacy" hidden><p class="dialog-intro">${escape(copy.privacyDialog.intro)}</p>${items(copy.privacyDialog.items)}<button class="text-button back-button" data-dialog="help">${escape(copy.back)}</button></section>
      <section data-panel="accessible" hidden><p class="dialog-intro">${escape(copy.accessibleDialog.intro)}</p><dl class="accessible-summary"><div><dt>${escape(copy.accessibleDialog.statusLabel)}</dt><dd data-summary="status"></dd></div><div><dt>${escape(copy.accessibleDialog.bordersLabel)}</dt><dd data-summary="borders"></dd></div><div><dt>${escape(copy.accessibleDialog.demoLabel)}</dt><dd data-summary="demo"></dd></div><div><dt>${escape(copy.accessibleDialog.motionLabel)}</dt><dd data-summary="motion"></dd></div></dl><button class="primary-button" data-dialog="demo">${escape(copy.accessibleDialog.openDemo)}</button><button class="text-button back-button" data-dialog="help">${escape(copy.back)}</button></section>
      <section data-panel="demo" hidden><p class="dialog-intro">${escape(copy.demo.intro)}</p><div class="demo-countries">${countries}</div><div class="demo-option"><div><strong>${escape(copy.demo.toggle)}</strong><p>${escape(copy.demo.toggleDescription)}</p></div><button class="compact-switch" role="switch" data-action="demo" aria-label="${escape(copy.demo.toggle)}" aria-checked="true" disabled><span class="switch-track" aria-hidden="true"><span></span></span></button></div></section>
    </div></dialog>
  </div><div id="control-tooltip" class="control-tooltip" role="tooltip" hidden></div>`;
}

export function mountAtlas(root: HTMLElement): () => void {
  root.innerHTML = template();
  const events = new AbortController();
  const query = <T extends Element>(selector: string): T => {
    const node = root.querySelector<T>(selector);
    if (!node) throw new Error(`Elemento ausente: ${selector}`);
    return node;
  };
  const setText = (node: Element, value: string): void => {
    if (node.textContent !== value) node.textContent = value;
  };
  const stage = query<HTMLElement>('.globe-stage');
  const host = query<HTMLDivElement>('.native-globe');
  const statusNode = query<HTMLElement>('[data-testid="globe-status"]');
  const selectionNode = query<HTMLElement>('[data-testid="selection-status"]');
  const fallback = query<HTMLElement>('.globe-fallback');
  const errorDescription = query<HTMLElement>('.error-description');
  const cameraButtons =
    root.querySelectorAll<HTMLButtonElement>('[data-camera]');
  const countryButtons =
    root.querySelectorAll<HTMLButtonElement>('[data-country]');
  const rotationButton = query<HTMLButtonElement>('[data-action="rotation"]');
  const bordersButton = query<HTMLButtonElement>('[data-action="borders"]');
  const demoButton = query<HTMLButtonElement>('[data-action="demo"]');
  const tooltip = query<HTMLDivElement>('#control-tooltip');
  const dialog = query<HTMLDialogElement>('.info-dialog');
  const dialogTitle = query<HTMLHeadingElement>('#dialog-title');
  const panels = root.querySelectorAll<HTMLElement>('[data-panel]');
  const summaries = {
    status: query<HTMLElement>('[data-summary="status"]'),
    borders: query<HTMLElement>('[data-summary="borders"]'),
    demo: query<HTMLElement>('[data-summary="demo"]'),
    motion: query<HTMLElement>('[data-summary="motion"]'),
  };
  const motionPreference = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  );
  let reducedMotion = motionPreference.matches;
  let autoRotate = !reducedMotion;
  let bordersVisible = true;
  let demoVisible = true;
  let activeDialog: DialogKind | null = null;
  let returnFocus: HTMLElement | null = null;
  let renderer: GlobeRenderer | null = null;
  let status: GlobeStatus = { state: 'loading' };
  let generation = 0;
  let disposed = false;
  let tooltipTarget: HTMLButtonElement | null = null;
  let hideTimer: number | undefined;

  const clearHideTimer = (): void => {
    window.clearTimeout(hideTimer);
    hideTimer = undefined;
  };
  const positionTooltip = (): void => {
    if (!tooltipTarget || tooltip.hidden) return;
    const box = tooltipTarget.getBoundingClientRect();
    const x = Math.min(
      window.innerWidth - tooltip.offsetWidth - 8,
      Math.max(8, box.left + (box.width - tooltip.offsetWidth) / 2),
    );
    let y =
      box.top < window.innerHeight / 2
        ? box.bottom + 9
        : box.top - tooltip.offsetHeight - 9;
    y = Math.min(window.innerHeight - tooltip.offsetHeight - 8, Math.max(8, y));
    tooltip.style.left = `${Math.round(x)}px`;
    tooltip.style.top = `${Math.round(y)}px`;
  };
  const hideTooltip = (): void => {
    clearHideTimer();
    tooltipTarget?.removeAttribute('aria-describedby');
    tooltipTarget = null;
    tooltip.hidden = true;
  };
  const showTooltip = (button: HTMLButtonElement): void => {
    if (activeDialog !== null || !button.dataset.tooltip) return;
    clearHideTimer();
    if (tooltipTarget !== button)
      tooltipTarget?.removeAttribute('aria-describedby');
    tooltipTarget = button;
    setText(tooltip, button.dataset.tooltip);
    tooltip.hidden = false;
    button.setAttribute('aria-describedby', tooltip.id);
    positionTooltip();
  };
  const scheduleTooltipHide = (): void => {
    clearHideTimer();
    hideTimer = window.setTimeout(() => {
      if (document.activeElement !== tooltipTarget) hideTooltip();
    }, 120);
  };
  const updateControls = (): void => {
    const ready = status.state === 'ready';
    for (const button of cameraButtons) button.disabled = !ready;
    for (const button of countryButtons) button.disabled = !ready;
    rotationButton.disabled = !ready || reducedMotion;
    const rotating = autoRotate && ready && !reducedMotion;
    rotationButton.setAttribute('aria-pressed', String(rotating));
    rotationButton.dataset.tooltip = reducedMotion
      ? copy.reducedMotion
      : rotating
        ? copy.tooltips.pauseRotation
        : copy.tooltips.playRotation;
    rotationButton.innerHTML = icon(rotating ? 'pause' : 'rotate');
    bordersButton.disabled = !ready;
    bordersButton.setAttribute('aria-checked', String(bordersVisible));
    bordersButton.dataset.tooltip = bordersVisible
      ? copy.tooltips.hideBorders
      : copy.tooltips.showBorders;
    demoButton.disabled = !ready;
    demoButton.setAttribute('aria-checked', String(demoVisible));
    setText(
      summaries.borders,
      bordersVisible
        ? copy.accessibleDialog.bordersVisible
        : copy.accessibleDialog.bordersHidden,
    );
    setText(
      summaries.demo,
      demoVisible
        ? copy.accessibleDialog.demoVisible
        : copy.accessibleDialog.demoHidden,
    );
    setText(
      summaries.motion,
      rotating
        ? copy.accessibleDialog.motionActive
        : copy.accessibleDialog.motionPaused,
    );
    if (tooltipTarget) showTooltip(tooltipTarget);
  };
  const updateStatus = (next: GlobeStatus): void => {
    status = next;
    stage.dataset.globeState = next.state;
    statusNode.dataset.state = next.state;
    setText(statusNode, copy.status[next.state]);
    setText(summaries.status, copy.status[next.state]);
    fallback.hidden = next.state !== 'error';
    setText(errorDescription, next.message ?? copy.error.description);
    updateControls();
  };
  const stopRotation = (): void => {
    if (!autoRotate) return;
    autoRotate = false;
    renderer?.setAutoRotate(false);
    updateControls();
  };
  const openDialog = (kind: DialogKind, trigger?: HTMLElement): void => {
    hideTooltip();
    stopRotation();
    if (!dialog.open)
      returnFocus =
        trigger ??
        (document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null);
    activeDialog = kind;
    const title =
      kind === 'help'
        ? copy.helpDialog.title
        : kind === 'privacy'
          ? copy.privacyDialog.title
          : kind === 'accessible'
            ? copy.accessibleDialog.title
            : copy.demo.title;
    setText(dialogTitle, title);
    dialog.classList.toggle('demo-dialog', kind === 'demo');
    for (const panel of panels) panel.hidden = panel.dataset.panel !== kind;
    if (!dialog.open) dialog.showModal();
    else dialogTitle.focus();
  };
  const closeDialog = (restoreFocus = true): void => {
    activeDialog = null;
    dialog.close();
    if (restoreFocus) returnFocus?.focus({ preventScroll: true });
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
        demoVisible,
        reducedMotion,
        onInteraction: stopRotation,
        onStatus: (next: GlobeStatus) => {
          if (!disposed && ownGeneration === generation) updateStatus(next);
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
      const kind = button.dataset.dialog;
      if (
        kind === 'help' ||
        kind === 'privacy' ||
        kind === 'accessible' ||
        kind === 'demo'
      ) {
        openDialog(kind, button);
        return;
      }
      const country = copy.demo.countries.find(
        (item) => item.code === button.dataset.country,
      );
      if (country && renderer && status.state === 'ready') {
        closeDialog(false);
        stage.focus({ preventScroll: true });
        stopRotation();
        renderer.goTo(country.longitude, country.latitude);
        setText(selectionNode, `${country.name}. ${copy.demo.selected}.`);
        return;
      }
      const action = button.dataset.action;
      if (action === 'close-dialog') closeDialog();
      else if (action === 'retry') initializeGlobe();
      else if (action === 'rotation') {
        autoRotate = !autoRotate;
        renderer?.setAutoRotate(autoRotate);
        updateControls();
      } else if (action === 'borders') {
        stopRotation();
        bordersVisible = !bordersVisible;
        renderer?.setBordersVisible(bordersVisible);
        updateControls();
      } else if (action === 'demo') {
        demoVisible = !demoVisible;
        renderer?.setDemoVisible(demoVisible);
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
    'pointerdown',
    () => {
      hideTooltip();
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
          'a,button,input,textarea,select,[contenteditable="true"]',
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
  root.addEventListener(
    'pointerover',
    (event) => {
      const button =
        event.target instanceof Element
          ? event.target.closest<HTMLButtonElement>('button[data-tooltip]')
          : null;
      if (button) showTooltip(button);
    },
    { signal: events.signal },
  );
  root.addEventListener(
    'pointerout',
    (event) => {
      if (!tooltipTarget) return;
      const next = event.relatedTarget;
      if (
        next instanceof Node &&
        (tooltipTarget.contains(next) || tooltip.contains(next))
      )
        return;
      scheduleTooltipHide();
    },
    { signal: events.signal },
  );
  root.addEventListener(
    'focusin',
    (event) => {
      if (
        event.target instanceof HTMLButtonElement &&
        event.target.dataset.tooltip
      )
        showTooltip(event.target);
    },
    { signal: events.signal },
  );
  root.addEventListener('focusout', () => hideTooltip(), {
    signal: events.signal,
  });
  root.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape' && !tooltip.hidden && activeDialog === null) {
        event.preventDefault();
        hideTooltip();
      }
    },
    { signal: events.signal },
  );
  tooltip.addEventListener('pointerenter', clearHideTimer, {
    signal: events.signal,
  });
  tooltip.addEventListener('pointerleave', scheduleTooltipHide, {
    signal: events.signal,
  });
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
  window.addEventListener('resize', positionTooltip, { signal: events.signal });
  updateStatus(status);
  initializeGlobe();
  return () => {
    if (disposed) return;
    disposed = true;
    generation += 1;
    events.abort();
    clearHideTimer();
    renderer?.destroy();
    renderer = null;
    if (dialog.open) dialog.close();
    root.replaceChildren();
  };
}
