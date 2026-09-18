/**
 * Lovelace bridge for integration-managed Vue Panel dashboards.
 *
 * This module stays deliberately small and registers the custom card before
 * importing the larger panel loader. Home Assistant can therefore resolve a
 * freshly opened dashboard immediately, including on an uncached browser.
 */
const moduleUrl = new URL(import.meta.url);
const integrationVersion = moduleUrl.searchParams.get('v');
const panelLoaderUrl = new URL('loader.js', moduleUrl);
if (integrationVersion) panelLoaderUrl.searchParams.set('v', integrationVersion);

const CARD_TAG = 'vue-panel-host';
const mountedPanels = new WeakMap();
const sidebarBootstraps = new WeakMap();
const SIDEBAR_STYLE_ID = 'vue-panel-hidden-sidebar';
const NATIVE_CHROME_STYLE = `
  .header {
    display: none !important;
  }

  hui-view-container,
  hui-view-container.has-tab-bar {
    padding-top: var(--view-container-padding-top, 0px) !important;
  }
`;

const SIDEBAR_SHELL_CSS = `
  :host { --ha-sidebar-width: 0px !important; --kiosk-sidebar-width: 0px; }
  partial-panel-resolver { --mdc-top-app-bar-width: 100% !important; }
  ha-drawer > ha-sidebar { display: none !important; }
  .header { width: 100% !important; }
`;

const SIDEBAR_DRAWER_CSS = `
  wa-drawer, .sidebar-shell, .mdc-drawer { display: none !important; }
`;

function setSidebarStyle(target, css) {
  if (!target) return;
  const existing = target.querySelector(`#${SIDEBAR_STYLE_ID}`);
  if (!css) {
    existing?.remove();
    return;
  }
  if (existing) {
    existing.textContent = css;
    return;
  }
  const style = document.createElement('style');
  style.id = SIDEBAR_STYLE_ID;
  style.textContent = css;
  target.appendChild(style);
}

function setSidebarHiddenEarly(hidden) {
  const main = document
    .querySelector('home-assistant')
    ?.shadowRoot?.querySelector('home-assistant-main');
  const drawer = main?.shadowRoot?.querySelector('ha-drawer');
  if (!main || !drawer) return;
  setSidebarStyle(drawer, hidden ? SIDEBAR_SHELL_CSS : '');
  setSidebarStyle(drawer.shadowRoot, hidden ? SIDEBAR_DRAWER_CSS : '');
  window.dispatchEvent(new Event('resize'));
}

function closestAcrossShadowRoots(element, selector) {
  let current = element;
  while (current) {
    if (current.matches?.(selector)) return current;
    if (current.parentElement) {
      current = current.parentElement;
      continue;
    }
    current = current.getRootNode?.().host || null;
  }
  return null;
}

/** Find elements through HA's nested open shadow roots. */
function findAcrossShadowRoots(root, selector, matches = []) {
  if (!root?.querySelectorAll) return matches;
  for (const element of root.querySelectorAll('*')) {
    if (element.matches(selector)) matches.push(element);
    if (element.shadowRoot) findAcrossShadowRoots(element.shadowRoot, selector, matches);
  }
  return matches;
}

function isVuePanelLovelaceRoot(lovelaceRoot) {
  const views = lovelaceRoot.lovelace?.config?.views;
  if (!Array.isArray(views)) return null;
  return views.some((view) => Array.isArray(view?.cards)
    && view.cards.some((card) => card?.type === `custom:${CARD_TAG}`));
}

/**
 * Repair the cold-cache race between HA rendering the dashboard and loading
 * its globally registered modules. When Lovelace built the view before this
 * module executed, the panel shows a `hui-error-card` ("Custom element
 * doesn't exist"). HA's own `customElements.whenDefined` rebuild covers most
 * cases, but it never retries when a module load failed once (the browser
 * pins failed module URLs) and it misses roots mounted much later.
 *
 * The watchdog below therefore stays armed for the whole page lifetime: it
 * re-checks on every navigation and visibility change, rebuilds broken cards
 * through HA's supported `ll-rebuild` event and only falls back to a full
 * throttled `config-refresh` when no error card is reachable.
 */
function repairBrokenRoots(step) {
  const roots = findAcrossShadowRoots(document, 'hui-root');
  // Signal "keep retrying" while no vue-panel root has rendered its config.
  let pending = roots.length === 0;

  for (const lovelaceRoot of roots) {
    const isVuePanel = isVuePanelLovelaceRoot(lovelaceRoot);
    if (isVuePanel === null) {
      pending = true;
      continue;
    }
    if (!isVuePanel) continue;
    if (findAcrossShadowRoots(lovelaceRoot.shadowRoot, CARD_TAG).length > 0) continue;

    pending = true;
    const errorCards = findAcrossShadowRoots(lovelaceRoot.shadowRoot, 'hui-error-card');
    if (errorCards.length > 0) {
      // hui-card listens for ll-rebuild directly on its created element and
      // recreates just that card - now resolving to the defined host.
      for (const errorCard of errorCards) {
        errorCard.dispatchEvent(new Event('ll-rebuild'));
      }
      continue;
    }

    // A freshly rendered root may briefly have neither host nor error card.
    // Only the later steps escalate to a full, throttled config refresh.
    if (step < 2) continue;
    const now = Date.now();
    if (now - repairState.lastConfigRefresh < 2000) continue;
    repairState.lastConfigRefresh = now;
    lovelaceRoot.dispatchEvent(
      new CustomEvent('config-refresh', { bubbles: true, composed: true }),
    );
  }

  return pending;
}

const REPAIR_DELAYS = [0, 300, 1000, 2500, 5000, 10000];

function armRepairWatchdog() {
  repairState.generation += 1;
  const generation = repairState.generation;
  const run = (step) => {
    if (generation !== repairState.generation) return;
    const pending = repairBrokenRoots(step);
    if (pending && step < REPAIR_DELAYS.length - 1) {
      window.setTimeout(() => run(step + 1), REPAIR_DELAYS[step + 1]);
    }
  };
  requestAnimationFrame(() => run(0));
}

// Single shared state even when this module is evaluated through both load
// channels (extra_module_url and the Lovelace resource use distinct URLs so
// one failed fetch cannot poison the other in the browser's module map).
const repairState = window.__vuePanelHostRepair || (window.__vuePanelHostRepair = {
  generation: 0,
  lastConfigRefresh: 0,
  listenersInstalled: false,
});

if (!repairState.listenersInstalled) {
  repairState.listenersInstalled = true;
  window.addEventListener('location-changed', armRepairWatchdog);
  window.addEventListener('popstate', armRepairWatchdog);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') armRepairWatchdog();
  });
}

function panelMountFor(lovelaceRoot, dashboardName) {
  let mount = mountedPanels.get(lovelaceRoot);
  if (mount) return mount;

  const viewContainer = lovelaceRoot.shadowRoot?.getElementById('view');
  if (!viewContainer) return null;

  const container = document.createElement('div');
  container.dataset.vuePanelDashboard = dashboardName;
  container.style.cssText = [
    'position:absolute',
    'inset:0',
    'z-index:1',
    'width:100%',
    'height:100vh',
    'height:100dvh',
    'overflow:hidden',
    'background:var(--primary-background-color)',
  ].join(';');

  const panel = document.createElement('vue-panel-panel');
  panel.embedded = true;
  container.appendChild(panel);

  // HA replaces only the last child when selecting another Lovelace view.
  // Keeping the engine mount first preserves its iframe and Vue runtime.
  viewContainer.insertBefore(container, viewContainer.firstChild);
  mount = { container, panel };
  mountedPanels.set(lovelaceRoot, mount);
  return mount;
}

class VuePanelHost extends HTMLElement {
  constructor() {
    super();
    this._config = null;
    this._hass = null;
    this._panelElement = null;
    this._mountGeneration = 0;
    this._nativeChromeStyle = null;
    this._nativeChromeFrame = 0;
    this._lovelaceRoot = null;
    this._sidebarCleanupFrame = 0;
    this._onLocationChanged = () => this._syncRoute();
    this._onResize = () => this._syncHostContext();
  }

  setConfig(config) {
    if (!config || typeof config.dashboardName !== 'string' || !config.dashboardName) {
      throw new Error('Vue Panel host requires dashboardName.');
    }
    this._config = { ...config };
    this._bootstrapSidebar();
    this._syncHostContext();
    this._mount();
  }

  set hass(value) {
    this._hass = value;
    this._syncHostContext();
  }

  get hass() {
    return this._hass;
  }

  connectedCallback() {
    this.style.cssText = [
      'display:block',
      'width:100%',
      'height:100vh',
      'height:100dvh',
      'overflow:hidden',
      'margin:0',
    ].join(';');
    window.addEventListener('location-changed', this._onLocationChanged);
    window.addEventListener('popstate', this._onLocationChanged);
    window.addEventListener('resize', this._onResize);
    this._hideNativeChrome();
    this._bootstrapSidebar();
    this._syncHostContext();
    this._mount();
  }

  disconnectedCallback() {
    this._mountGeneration += 1;
    window.removeEventListener('location-changed', this._onLocationChanged);
    window.removeEventListener('popstate', this._onLocationChanged);
    window.removeEventListener('resize', this._onResize);
    cancelAnimationFrame(this._nativeChromeFrame);
    this._nativeChromeFrame = 0;
    this._nativeChromeStyle?.remove();
    this._nativeChromeStyle = null;
    const lovelaceRoot = this._lovelaceRoot;
    cancelAnimationFrame(this._sidebarCleanupFrame);
    this._sidebarCleanupFrame = requestAnimationFrame(() => {
      this._sidebarCleanupFrame = 0;
      if (lovelaceRoot?.isConnected || !sidebarBootstraps.get(lovelaceRoot)) return;
      setSidebarHiddenEarly(false);
      sidebarBootstraps.delete(lovelaceRoot);
    });
  }

  getCardSize() {
    return 12;
  }

  getGridOptions() {
    return { columns: 'full', rows: 'full', min_columns: 1, min_rows: 1 };
  }

  _hideNativeChrome() {
    if (!this.isConnected || this._nativeChromeStyle) return;
    const lovelaceRoot = closestAcrossShadowRoots(this, 'hui-root');
    if (!lovelaceRoot?.shadowRoot) {
      this._nativeChromeFrame = requestAnimationFrame(() => {
        this._nativeChromeFrame = 0;
        this._hideNativeChrome();
      });
      return;
    }

    const style = document.createElement('style');
    style.dataset.vuePanelNativeChrome = 'hidden';
    style.textContent = NATIVE_CHROME_STYLE;
    lovelaceRoot.shadowRoot.appendChild(style);
    this._nativeChromeStyle = style;
  }

  _bootstrapSidebar() {
    if (!this.isConnected || !this._config) return;
    const lovelaceRoot = closestAcrossShadowRoots(this, 'hui-root');
    if (!lovelaceRoot) return;
    this._lovelaceRoot = lovelaceRoot;
    if (sidebarBootstraps.has(lovelaceRoot)) return;
    const hidden = this._config.hideHaSidebar === true;
    sidebarBootstraps.set(lovelaceRoot, hidden);
    if (hidden) setSidebarHiddenEarly(true);
  }

  async _mount() {
    if (!this.isConnected || !this._config || this._panelElement) return;
    const generation = ++this._mountGeneration;
    try {
      await import(panelLoaderUrl.href);
      if (!this.isConnected || generation !== this._mountGeneration) return;
      const lovelaceRoot = closestAcrossShadowRoots(this, 'hui-root');
      const mount = lovelaceRoot
        ? panelMountFor(lovelaceRoot, this._config.dashboardName)
        : null;
      if (!mount) throw new Error('Home Assistant Lovelace view container was not found.');
      const panel = mount.panel;
      this._panelElement = panel;
      this._syncHostContext();
    } catch (error) {
      if (!this.isConnected || generation !== this._mountGeneration) return;
      this.textContent = `Vue Panel could not be loaded: ${error?.message || error}`;
      this.style.padding = '16px';
      this.style.color = 'var(--error-color, #db4437)';
    }
  }

  _syncHostContext() {
    const panel = this._panelElement;
    const config = this._config;
    if (!panel || !config) return;
    panel.hass = this._hass;
    panel.narrow = window.matchMedia('(max-width: 870px)').matches;
    panel.panel = {
      title: config.title || 'Vue Panel',
      url_path: config.dashboardName,
      config: {
        dashboardName: config.dashboardName,
        engineVersion: config.engineVersion,
        apiVersion: config.apiVersion,
      },
    };
    this._syncRoute();
  }

  _syncRoute() {
    const panel = this._panelElement;
    const dashboardName = this._config?.dashboardName;
    if (!panel || !dashboardName) return;
    const prefix = `/${String(dashboardName).replace(/^\/+|\/+$/g, '')}`;
    const pathname = location.pathname;
    // A foreign pathname means HA is navigating away from this dashboard.
    // Forwarding it (as an empty panel path) would make the engine redirect
    // to its default view and echo that back, yanking HA into the panel again.
    if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) return;
    const path = pathname === prefix ? '' : pathname.slice(prefix.length);
    panel.route = { prefix, path };
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, VuePanelHost);
}
armRepairWatchdog();

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card?.type === CARD_TAG)) {
  window.customCards.push({
    type: CARD_TAG,
    name: 'Vue Panel Dashboard',
    description: 'Hosts an integration-managed Vue Panel dashboard.',
    preview: false,
  });
}
