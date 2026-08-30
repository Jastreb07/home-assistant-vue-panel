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

/** Marker for the style element that collapses Home Assistant's sidebar. */
const SIDEBAR_STYLE_ID = 'vue-panel-hidden-sidebar';

/**
 * Home Assistant's sidebar lives in the shadow DOM of `home-assistant-main`,
 * several closed-off levels above this panel. Reaching it means walking that
 * chain by hand; every step is optional so a future HA layout can only make
 * this a no-op, never an exception that breaks the panel.
 */
function haShell() {
  const main = document
    .querySelector('home-assistant')
    ?.shadowRoot?.querySelector('home-assistant-main');
  const mainRoot = main?.shadowRoot ?? null;
  return {
    main: main ?? null,
    drawer: mainRoot?.querySelector('ha-drawer') ?? null,
  };
}

/**
 * Append a marked <style> to a node once; `css` empty removes it again.
 * The target may be a shadow root or a plain element — appending to the
 * element puts the rules in its surrounding shadow tree, which is exactly
 * how the sidebar rules below need to be scoped.
 */
function setScopedStyle(target, css) {
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

/*
 * Rules taken from the kiosk-mode integration, which tracks Home Assistant's
 * shifting internals. Two scopes are needed:
 *
 * - In the shell's tree (appended to the drawer element, so `:host` is
 *   `home-assistant-main`): zero the sidebar width variable everything below
 *   reads, hide the sidebar itself, and let the toolbar reclaim the space.
 * - Inside the drawer's own shadow root: hide its container. Current HA
 *   builds that from `wa-drawer` / `.sidebar-shell` — the older `.mdc-drawer`
 *   is kept so this still works on installations that predate the switch.
 */
const SIDEBAR_SHELL_CSS = `
  :host { --ha-sidebar-width: 0px !important; --kiosk-sidebar-width: 0px; }
  partial-panel-resolver { --mdc-top-app-bar-width: 100% !important; }
  ha-drawer > ha-sidebar { display: none !important; }
  .header { width: 100% !important; }
`;

const SIDEBAR_DRAWER_CSS = `
  wa-drawer, .sidebar-shell, .mdc-drawer { display: none !important; }
`;

/** Swallows the event HA fires when something asks to open the sidebar. */
function blockToggleMenu(event) {
  event.stopPropagation();
}

/**
 * Open one of Home Assistant's own screens on behalf of the engine.
 *
 * The settings page is a normal HA route, so it goes through the same
 * 'location-changed' hand-off the panel's own navigation uses. The
 * notification drawer is not a route at all — HA's sidebar opens it by
 * firing 'hass-show-notifications', which `home-assistant-main` listens for.
 */
function openHostTarget(target) {
  const { main } = haShell();

  if (target === 'notifications') {
    if (!main) {
      console.warn('[Vue Panel] Home Assistant shell not found — cannot open notifications.');
      return;
    }
    main.dispatchEvent(
      new CustomEvent('hass-show-notifications', { bubbles: true, composed: true }),
    );
    return;
  }

  if (target !== 'settings') return;

  if (location.pathname !== '/config/dashboard') {
    window.history.pushState(null, '', '/config/dashboard');
    window.dispatchEvent(
      new CustomEvent('location-changed', {
        detail: { replace: false },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

/**
 * Collapse or restore the sidebar. Stylesheets rather than inline styles: HA
 * re-renders the drawer on its own (narrow/wide changes, navigation), which
 * would drop inline styles but keeps an appended <style>. Restoring removes
 * them again, so nothing of ours survives leaving the panel.
 */
function setSidebarHidden(hidden) {
  const { main, drawer } = haShell();

  if (!main || !drawer) {
    if (hidden) {
      console.warn('[Vue Panel] Home Assistant sidebar not found — cannot hide it.');
    }
    return;
  }

  main.removeEventListener('hass-toggle-menu', blockToggleMenu, true);

  if (!hidden) {
    setScopedStyle(drawer, '');
    setScopedStyle(drawer.shadowRoot, '');
    window.dispatchEvent(new Event('resize'));
    return;
  }

  const hide = () => {
    // Without this the menu button would still swing the sidebar back in.
    main.addEventListener('hass-toggle-menu', blockToggleMenu, true);
    setScopedStyle(drawer, SIDEBAR_SHELL_CSS);
    setScopedStyle(drawer.shadowRoot, SIDEBAR_DRAWER_CSS);
    window.dispatchEvent(new Event('resize'));
  };

  /*
   * On narrow screens the sidebar is a modal overlay. Hiding it mid-animation
   * leaves the backdrop behind, so wait for it to finish closing first.
   */
  if (drawer.type === 'modal' && drawer.open) {
    drawer.addEventListener('hass-drawer-closed', hide, { once: true });
    return;
  }

  hide();
}

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
    /** Whether this panel currently asks for HA's sidebar to be collapsed. */
    this._sidebarHidden = false;
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
    // Re-entering the panel: the engine only reports changes, so restore the
    // state we already know instead of waiting for a message that never comes.
    if (this._sidebarHidden) setSidebarHidden(true);
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
    // Leaving the panel must never leave the rest of HA without its sidebar.
    if (this._sidebarHidden) {
      this._sidebarHidden = false;
      setSidebarHidden(false);
    }
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

  /**
   * Follow a link a card asked to open. Only http(s) is allowed through:
   * a card is authored content, and `javascript:` or `data:` URLs would run
   * in the Home Assistant page itself, outside the panel's boundary.
   */
  _openUrl(url, newTab) {
    let parsed;
    try {
      parsed = new URL(String(url), location.href);
    } catch {
      console.warn('[Vue Panel] Ignoring malformed link:', url);
      return;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      console.warn('[Vue Panel] Ignoring unsupported link protocol:', parsed.protocol);
      return;
    }
    if (newTab) window.open(parsed.href, '_blank', 'noopener');
    else location.assign(parsed.href);
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
    if (event.data?.type === 'vue-panel:host-open') {
      openHostTarget(event.data.target);
      return;
    }
    if (event.data?.type === 'vue-panel:open-url') {
      this._openUrl(event.data.url, event.data.newTab === true);
      return;
    }
    if (event.data?.type === 'vue-panel:open-view') {
      const path = String(event.data.path || '').replace(/^\/+|\/+$/g, '');
      window.open(
        `${this._routePrefix()}${path ? `/${path}` : ''}`,
        '_blank',
        'noopener',
      );
      return;
    }
    if (event.data?.type === 'vue-panel:sidebar') {
      this._sidebarHidden = event.data.hidden === true;
      setSidebarHidden(this._sidebarHidden);
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
