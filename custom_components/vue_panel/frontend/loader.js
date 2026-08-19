const loaderUrl = new URL(import.meta.url);
const versionUrl = new URL('version.json', loaderUrl);
const loaderVersion = loaderUrl.searchParams.get('v');
if (loaderVersion) versionUrl.searchParams.set('ver', loaderVersion);

const response = await fetch(versionUrl, { cache: 'no-store' });
if (!response.ok) {
  throw new Error(`Unable to load Vue Panel version manifest (${response.status})`);
}

const version = await response.json();
if (typeof version.engineVersion !== 'string' || !version.engineVersion) {
  throw new Error('Vue Panel version manifest contains an invalid engine version');
}

const frameUrl = new URL('engine/index.html', loaderUrl);
frameUrl.search = '';
frameUrl.searchParams.set('ver', version.engineVersion);

const ELEMENT_NAME = 'vue-panel-panel';

/** Panel sub-path of a HA route object: '/vue-test/overview' → 'overview'. */
function routeSubPath(route) {
  const path = typeof route?.path === 'string' ? route.path : '';
  return path.replace(/^\/+|\/+$/g, '');
}

class VuePanelElement extends HTMLElement {
  constructor() {
    super();
    this._iframe = null;
    this._hass = null;
    this._panel = null;
    this._narrow = false;
    this._route = null;
    this._readyVersion = '';
    /** Last path exchanged with the engine — guards against ping-pong updates. */
    this._enginePath = null;
    this._onFrameLoad = () => this._sendContext();
    this._onWindowMessage = (event) => this._handleMessage(event);

    for (const property of ['hass', 'panel', 'narrow', 'route']) {
      this._upgradeProperty(property);
    }
  }

  connectedCallback() {
    this.style.cssText =
      'display:block;width:100%;height:100vh;height:100dvh;overflow:hidden;';
    window.addEventListener('message', this._onWindowMessage);
    if (this._iframe) return;

    this._iframe = document.createElement('iframe');
    this._iframe.src = frameUrl.href;
    this._iframe.title = this._panel?.title || 'Vue Panel';
    this._iframe.style.cssText = 'width:100%;height:100%;border:0;display:block;';
    this._iframe.addEventListener('load', this._onFrameLoad);
    this.appendChild(this._iframe);
    console.info(`[Vue Panel] Loading iframe engine ${version.engineVersion} from ${frameUrl}`);
  }

  disconnectedCallback() {
    window.removeEventListener('message', this._onWindowMessage);
  }

  set hass(value) {
    this._hass = value;
    this._sendContext();
  }

  get hass() {
    return this._hass;
  }

  set panel(value) {
    this._panel = value;
    if (this._iframe) this._iframe.title = value?.title || 'Vue Panel';
    this._sendContext();
  }

  get panel() {
    return this._panel;
  }

  set narrow(value) {
    this._narrow = Boolean(value);
    this._sendContext();
  }

  get narrow() {
    return this._narrow;
  }

  set route(value) {
    this._route = value;
    this._sendContext();
    this._sendRoute();
  }

  get route() {
    return this._route;
  }

  /** Prefix of the panel inside the HA URL, e.g. '/vue-test'. */
  _routePrefix() {
    const prefix = typeof this._route?.prefix === 'string' ? this._route.prefix : '';
    if (prefix) return prefix.replace(/\/+$/, '');
    const urlPath = this._panel?.url_path;
    if (urlPath) return `/${String(urlPath).replace(/^\/+|\/+$/g, '')}`;
    return `/${location.pathname.replace(/^\/+/, '').split('/')[0] || ''}`;
  }

  /** Forward a HA-side route change (deep link, back button) to the engine. */
  _sendRoute() {
    const target = this._iframe?.contentWindow;
    // Before the engine announced itself the initial path travels with the context.
    if (!target || !this._readyVersion) return;
    const path = routeSubPath(this._route);
    if (path === this._enginePath) return;
    this._enginePath = path;
    target.postMessage({ type: 'vue-panel:route', path }, location.origin);
  }

  /**
   * Mirror an engine navigation into the HA address bar so every view keeps a
   * real, shareable URL. HA's router listens for 'location-changed'.
   */
  _applyEnginePath(path, replace) {
    const normalized = String(path || '').replace(/^\/+|\/+$/g, '');
    if (normalized === this._enginePath) return;
    this._enginePath = normalized;

    const url = `${this._routePrefix()}${normalized ? `/${normalized}` : ''}`;
    if (url === location.pathname) return;

    if (replace) window.history.replaceState(window.history.state, '', url);
    else window.history.pushState(null, '', url);

    window.dispatchEvent(
      new CustomEvent('location-changed', {
        detail: { replace: Boolean(replace) },
        bubbles: true,
        composed: true,
      }),
    );
  }

  _upgradeProperty(property) {
    if (!Object.prototype.hasOwnProperty.call(this, property)) return;
    const value = this[property];
    delete this[property];
    this[property] = value;
  }

  _sendContext() {
    const target = this._iframe?.contentWindow;
    const auth = this._hass?.auth?.data;
    const config = this._panel?.config;
    if (!target || !auth?.access_token || !config?.dashboardName) return;

    target.postMessage(
      {
        type: 'vue-panel:auth',
        hassUrl: auth.hassUrl || location.origin,
        access_token: auth.access_token,
        expires: auth.expires,
        language: this._hass?.locale?.language || this._hass?.language || '',
        isAdmin: this._hass?.user?.is_admin === true,
        dashboardName: config.dashboardName,
        engineVersion: config.engineVersion || version.engineVersion,
        apiVersion: config.apiVersion,
        narrow: this._narrow,
        routePath: routeSubPath(this._route),
      },
      location.origin,
    );
  }

  _handleMessage(event) {
    if (event.origin !== location.origin || event.source !== this._iframe?.contentWindow) return;
    if (event.data?.type === 'vue-panel:request-context') {
      this._sendContext();
      return;
    }
    if (event.data?.type === 'vue-panel:navigate') {
      this._applyEnginePath(event.data.path, event.data.replace === true);
      return;
    }
    if (event.data?.type !== 'vue-panel:ready') return;
    const loadedVersion = String(event.data.engineVersion || version.engineVersion);
    if (loadedVersion === this._readyVersion) return;
    this._readyVersion = loadedVersion;
    // Catch up on route changes that happened while the engine was starting —
    // unless the engine already authored a path of its own.
    if (this._enginePath === null) this._sendRoute();
    console.info(`[Vue Panel] Engine ${loadedVersion} loaded in isolated iframe`);
  }
}

if (!customElements.get(ELEMENT_NAME)) {
  customElements.define(ELEMENT_NAME, VuePanelElement);
}
