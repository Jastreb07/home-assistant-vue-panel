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
const NATIVE_CHROME_STYLE = `
  .header {
    display: none !important;
  }

  hui-view-container,
  hui-view-container.has-tab-bar {
    padding-top: var(--view-container-padding-top, 0px) !important;
  }
`;

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
    this._onLocationChanged = () => this._syncRoute();
    this._onResize = () => this._syncHostContext();
  }

  setConfig(config) {
    if (!config || typeof config.dashboardName !== 'string' || !config.dashboardName) {
      throw new Error('Vue Panel host requires dashboardName.');
    }
    this._config = { ...config };
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
    const path = pathname === prefix
      ? ''
      : pathname.startsWith(`${prefix}/`)
        ? pathname.slice(prefix.length)
        : '';
    panel.route = { prefix, path };
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, VuePanelHost);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card?.type === CARD_TAG)) {
  window.customCards.push({
    type: CARD_TAG,
    name: 'Vue Panel Dashboard',
    description: 'Hosts an integration-managed Vue Panel dashboard.',
    preview: false,
  });
}
