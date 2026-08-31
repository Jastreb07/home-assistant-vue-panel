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

/**
 * Home Assistant card helpers, loaded once. `loadCardHelpers` is a global the
 * HA frontend installs on its own window; it resolves the module that knows
 * how to turn a Lovelace config into an element.
 */
let cardHelpersPromise = null;

function cardHelpers() {
  if (!cardHelpersPromise) {
    cardHelpersPromise = typeof window.loadCardHelpers === 'function'
      ? window.loadCardHelpers()
      : Promise.reject(new Error('Home Assistant card helpers are unavailable.'));
  }
  return cardHelpersPromise;
}

/** Custom element a Lovelace card type renders as. */
function hassCardTag(type) {
  const name = String(type || '');
  return name.startsWith('custom:') ? name.slice('custom:'.length) : `hui-${name}-card`;
}

/**
 * The element class behind a card type, needed for its static
 * `getConfigElement()`. Building the card is only a way to make Home
 * Assistant import and register it: a half-finished config (a light card
 * without an entity, say) makes `setConfig` throw, and that is exactly the
 * case the editor is opened for — so the throw is expected and the class is
 * looked up from the custom element registry afterwards.
 */
async function hassCardClass(helpers, config) {
  try {
    const card = helpers.createCardElement(config);
    if (typeof card?.constructor?.getConfigElement === 'function') return card.constructor;
  } catch {
    // Registered nonetheless — fall through to the registry lookup
  }
  const tag = hassCardTag(config?.type);
  if (!customElements.get(tag)) {
    await Promise.race([
      customElements.whenDefined(tag),
      new Promise((resolve) => window.setTimeout(resolve, 3000)),
    ]);
  }
  return customElements.get(tag) ?? null;
}

class VuePanelElement extends HTMLElement {
  constructor() {
    super();
    this._iframe = null;
    /**
     * Native Home Assistant cards the engine asked for, by overlay id. The
     * engine only renders a placeholder inside its iframe — the real card is
     * created here and positioned over that placeholder.
     */
    this._hassCards = new Map();
    this._hassLayer = null;
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
    // Overlay cards belong to the engine's current DOM — it rebuilds them
    // (and asks for fresh ones) when the panel is entered again.
    this._clearHassCards();
    // Leaving the panel must never leave the rest of HA without its sidebar.
    if (this._sidebarHidden) {
      this._sidebarHidden = false;
      setSidebarHidden(false);
    }
  }

  set hass(value) {
    this._hass = value;
    this._sendContext();
    this._updateHassCards();
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

  _sendMediaResult(requestId, value, error) {
    const target = this._iframe?.contentWindow;
    if (!target || typeof requestId !== 'string' || !requestId) return;
    target.postMessage(
      {
        type: 'vue-panel:media-result',
        requestId,
        value,
        error: error ? String(error) : undefined,
      },
      location.origin,
    );
  }

  /**
   * Use HA's own media selector in the parent document. The selector lazily
   * imports the native browser and supplies its private dialog loader, which a
   * custom panel cannot import through a stable public URL itself.
   */
  async _pickMedia(requestId, current) {
    let selector;
    let cleanupTimer;
    try {
      if (!customElements.get('ha-selector') && typeof window.loadCardHelpers === 'function') {
        await window.loadCardHelpers();
      }
      await Promise.race([
        customElements.whenDefined('ha-selector'),
        new Promise((_, reject) => window.setTimeout(
          () => reject(new Error('Home Assistant media selector is unavailable.')),
          5000,
        )),
      ]);

      selector = document.createElement('ha-selector');
      selector.style.cssText = 'position:fixed;width:1px;height:1px;left:-10000px;overflow:hidden;';
      selector.hass = this._hass;
      selector.required = false;
      selector.selector = {
        media: {
          accept: ['image/*'],
          hide_content_type: true,
        },
      };
      selector.value = current && typeof current.media_content_id === 'string' ? current : undefined;

      const finish = (value, error) => {
        window.clearTimeout(cleanupTimer);
        selector?.remove();
        this._sendMediaResult(requestId, value, error);
      };
      selector.addEventListener('value-changed', (event) => {
        event.stopPropagation();
        const value = event.detail?.value;
        if (!value?.media_content_id) return;
        finish(JSON.parse(JSON.stringify(value)));
      }, { once: true });
      // Keep the bridge inside the panel element. Home Assistant's dialog
      // manager listens above the panel in the composed element tree; an
      // element appended directly to document.body is its sibling, so the
      // selector's bubbling `show-dialog` event would never reach HA.
      this.appendChild(selector);

      // Lit first renders the dynamic selector and then its lazily imported
      // media implementation. Wait for both update cycles before clicking.
      await selector.updateComplete;
      await customElements.whenDefined('ha-selector-media');
      await selector.updateComplete;
      const mediaSelector = selector.shadowRoot?.querySelector('ha-selector-media');
      await mediaSelector?.updateComplete;
      const picker = mediaSelector?.shadowRoot?.querySelector('ha-card');
      if (!picker) throw new Error('Home Assistant media selector did not render.');
      picker.click();

      // A closed picker has no callback. Avoid retaining the hidden bridge
      // forever; a later click simply creates a fresh request.
      cleanupTimer = window.setTimeout(() => selector?.remove(), 10 * 60_000);
    } catch (error) {
      selector?.remove();
      this._sendMediaResult(requestId, undefined, error instanceof Error ? error.message : error);
    }
  }

  /** Upload to HA's native image media source and return its stable id. */
  async _uploadMedia(requestId, file) {
    try {
      if (!(file instanceof File) || !['image/png', 'image/jpeg', 'image/gif'].includes(file.type)) {
        throw new Error('Only JPEG, PNG and GIF images are supported.');
      }
      if (!this._hass?.fetchWithAuth) throw new Error('Home Assistant is not ready.');

      const form = new FormData();
      form.append('file', file);
      const response = await this._hass.fetchWithAuth('/api/image/upload', {
        method: 'POST',
        body: form,
      });
      if (!response.ok) {
        throw new Error(response.status === 413
          ? `Image "${file.name}" is too large.`
          : `Image upload failed (${response.status}).`);
      }
      const image = await response.json();
      if (!image?.id) throw new Error('Home Assistant returned an invalid image.');
      this._sendMediaResult(requestId, {
        media_content_id: `media-source://image_upload/${image.id}`,
        media_content_type: image.content_type || file.type,
        metadata: {
          title: image.name || file.name,
          thumbnail: `/api/image/serve/${image.id}/256x256`,
          media_class: 'image',
        },
      });
    } catch (error) {
      this._sendMediaResult(requestId, undefined, error instanceof Error ? error.message : error);
    }
  }

  /**
   * Container the overlay cards live in. It sits inside the panel element so
   * HA's dialog manager still receives the events a card fires (more-info,
   * service calls), and it never swallows clicks itself — only the cards do.
   */
  _hassOverlayLayer() {
    if (this._hassLayer?.isConnected) return this._hassLayer;
    const layer = document.createElement('div');
    layer.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:1;';
    this.appendChild(layer);
    this._hassLayer = layer;
    return layer;
  }

  /** Create (or replace) the HA card element for one overlay id. */
  async _createHassCard(id, config) {
    if (typeof id !== 'string' || !id) return;
    const previous = this._hassCards.get(id);
    previous?.wrapper?.remove();

    const wrapper = document.createElement('div');
    wrapper.style.cssText =
      'position:absolute;pointer-events:auto;overflow:hidden;display:none;';
    this._hassOverlayLayer().appendChild(wrapper);
    // The rect may arrive before the element is built — remember it either way
    const entry = { wrapper, element: null, rect: previous?.rect ?? null };
    this._hassCards.set(id, entry);

    try {
      const helpers = await cardHelpers();
      // A destroy could have arrived while the helpers were loading
      if (this._hassCards.get(id) !== entry) return;
      const element = helpers.createCardElement(config || { type: 'entities' });
      element.hass = this._hass;
      element.style.cssText = 'display:block;width:100%;height:100%;';
      entry.element = element;
      wrapper.appendChild(element);
      if (entry.rect) this._placeHassCard(id, entry.rect);
    } catch (error) {
      if (this._hassCards.get(id) !== entry) return;
      wrapper.textContent = String(error?.message || error);
      wrapper.style.cssText +=
        'padding:12px;border:2px dashed var(--divider,#888);border-radius:12px;'
        + 'color:var(--secondary-text-color,#888);font-size:12px;';
      if (entry.rect) this._placeHassCard(id, entry.rect);
    }
  }

  /**
   * Home Assistant's own settings form for a card. Every card class may expose
   * one through the static `getConfigElement()`; cards without it (and every
   * failure here) fall back to the engine's JSON editor, which is why the
   * engine is told explicitly whether an editor could be built.
   */
  async _createHassEditor(id, config) {
    if (typeof id !== 'string' || !id) return;
    this._hassCards.get(id)?.wrapper.remove();

    const wrapper = document.createElement('div');
    wrapper.style.cssText =
      'position:absolute;pointer-events:auto;overflow:auto;display:none;';
    this._hassOverlayLayer().appendChild(wrapper);
    const entry = { wrapper, element: null, rect: null };
    this._hassCards.set(id, entry);

    try {
      const helpers = await cardHelpers();
      if (this._hassCards.get(id) !== entry) return;
      const cardClass = await hassCardClass(helpers, config || { type: 'entities' });
      const editor = await cardClass?.getConfigElement?.();
      if (!editor) throw new Error('This card has no visual editor.');
      if (this._hassCards.get(id) !== entry) return;

      editor.hass = this._hass;
      editor.setConfig(config || {});
      editor.style.cssText = 'display:block;width:100%;';
      editor.addEventListener('config-changed', (event) => {
        event.stopPropagation();
        const next = event.detail?.config;
        if (!next) return;
        /*
         * Home Assistant's card editors are controlled components: they report
         * a change but keep rendering their last `setConfig` value. In HA the
         * surrounding `hui-card-element-editor` feeds the new config straight
         * back — without that the field the user just filled in snaps empty
         * again, so this bridge has to do the same.
         */
        try {
          editor.setConfig(next);
        } catch {
          // A config the card rejects is still worth storing — the preview shows why
        }
        this._iframe?.contentWindow?.postMessage(
          { type: 'vue-panel:hass-editor-config', id, config: JSON.parse(JSON.stringify(next)) },
          location.origin,
        );
      });
      entry.element = editor;
      wrapper.appendChild(editor);
      this._sendEditorReady(id, true);
      if (entry.rect) this._placeHassCard(id, entry.rect);
    } catch {
      if (this._hassCards.get(id) !== entry) return;
      this._destroyHassCard(id);
      this._sendEditorReady(id, false);
    }
  }

  _sendEditorReady(id, available) {
    this._iframe?.contentWindow?.postMessage(
      { type: 'vue-panel:hass-editor-ready', id, available },
      location.origin,
    );
  }

  /** Swap a card's configuration without rebuilding it where possible. */
  async _configureHassCard(id, config) {
    const entry = this._hassCards.get(id);
    if (!entry) return;
    /*
     * A config Home Assistant rejected produced `hui-error-card`, and that
     * element happily accepts any later config while still rendering the
     * error. Once the user fixes the configuration the real card has to be
     * built from scratch.
     */
    const isErrorCard = entry.element?.localName === 'hui-error-card';
    if (isErrorCard || !entry.element || typeof entry.element.setConfig !== 'function') {
      await this._createHassCard(id, config);
      return;
    }
    try {
      entry.element.setConfig(config);
      entry.element.hass = this._hass;
    } catch {
      // Some cards reject a live config change — rebuild them instead
      await this._createHassCard(id, config);
    }
  }

  _placeHassCard(id, rect) {
    const entry = this._hassCards.get(id);
    if (!entry || !rect) return;
    entry.rect = rect;
    const frame = this._iframe?.getBoundingClientRect();
    if (!frame) return;
    const style = entry.wrapper.style;
    if (!rect.visible) {
      style.display = 'none';
      return;
    }
    // The engine reports viewport coordinates of its own iframe document
    style.display = 'block';
    style.left = `${frame.left + rect.left}px`;
    style.top = `${frame.top + rect.top}px`;
    style.width = `${rect.width}px`;
    style.height = `${rect.height}px`;
    /*
     * The card is painted outside the engine's document, so the scroll
     * containers and dialogs its placeholder sits in cannot clip it. The
     * engine measures how much of the placeholder those ancestors leave
     * visible and that region is cut out here.
     */
    const clip = rect.clip;
    style.clipPath = clip
      ? `inset(${clip.top || 0}px ${clip.right || 0}px ${clip.bottom || 0}px ${clip.left || 0}px)`
      : 'none';
  }

  _destroyHassCard(id) {
    const entry = this._hassCards.get(id);
    if (!entry) return;
    this._hassCards.delete(id);
    entry.wrapper.remove();
  }

  _clearHassCards() {
    for (const entry of this._hassCards.values()) entry.wrapper.remove();
    this._hassCards.clear();
    this._hassLayer?.remove();
    this._hassLayer = null;
  }

  /** Keep every overlay card fed with the current hass object. */
  _updateHassCards() {
    for (const entry of this._hassCards.values()) {
      if (entry.element) entry.element.hass = this._hass;
    }
  }

  /** Custom cards installed in HA register themselves in `window.customCards`. */
  _sendCustomCards() {
    const target = this._iframe?.contentWindow;
    if (!target) return;
    const list = Array.isArray(window.customCards) ? window.customCards : [];
    target.postMessage(
      {
        type: 'vue-panel:hass-custom-cards',
        cards: list.map((card) => ({
          type: String(card?.type || ''),
          name: card?.name ? String(card.name) : undefined,
          description: card?.description ? String(card.description) : undefined,
          preview: card?.preview === true,
        })).filter((card) => card.type),
      },
      location.origin,
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
    if (event.data?.type === 'vue-panel:host-open') {
      openHostTarget(event.data.target);
      return;
    }
    if (event.data?.type === 'vue-panel:ha-more-info') {
      const entityId = String(event.data.entityId || '');
      if (!/^[a-z0-9_]+\.[a-z0-9_]+$/.test(entityId)) return;
      this.dispatchEvent(
        new CustomEvent('hass-more-info', {
          detail: { entityId },
          bubbles: true,
          composed: true,
        }),
      );
      return;
    }
    if (event.data?.type === 'vue-panel:pick-media') {
      this._pickMedia(event.data.requestId, event.data.current);
      return;
    }
    if (event.data?.type === 'vue-panel:upload-media') {
      this._uploadMedia(event.data.requestId, event.data.file);
      return;
    }
    if (event.data?.type === 'vue-panel:hass-card-create') {
      this._createHassCard(event.data.id, event.data.config);
      return;
    }
    if (event.data?.type === 'vue-panel:hass-editor-create') {
      this._createHassEditor(event.data.id, event.data.config);
      return;
    }
    if (event.data?.type === 'vue-panel:hass-card-config') {
      this._configureHassCard(event.data.id, event.data.config);
      return;
    }
    if (event.data?.type === 'vue-panel:hass-card-rect') {
      this._placeHassCard(event.data.id, event.data.rect);
      return;
    }
    if (event.data?.type === 'vue-panel:hass-card-destroy') {
      this._destroyHassCard(event.data.id);
      return;
    }
    if (event.data?.type === 'vue-panel:hass-custom-cards-request') {
      this._sendCustomCards();
      return;
    }
    if (event.data?.type === 'vue-panel:reload') {
      // The whole page, so a new loader and engine version are picked up too.
      location.reload();
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
