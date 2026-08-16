// Stable entry point for panel_custom (module_url points here).
// This file never changes — updates require neither configuration.yaml
// changes nor an HA restart. version.txt (read uncached) decides
// which build gets loaded.
const BASE = '/local/vue-panel';

const v = await fetch(`${BASE}/version.txt`, { cache: 'no-store' })
  .then((r) => (r.ok ? r.text() : ''))
  .catch(() => '');
const ver = v.trim() || '1';

// Custom element that HA instantiates for the panel (name: vue-panel
// in panel_custom => element tag <vue-panel>). HA sets the `hass`
// property (incl. auth) on every state update.
class VuePanelElement extends HTMLElement {
  constructor() {
    super();
    this._iframe = null;
    this._hass = null;
  }

  connectedCallback() {
    if (this._iframe) return;
    this.style.cssText = 'display:block;height:100%;';
    this._iframe = document.createElement('iframe');
    this._iframe.src = `${BASE}/index.html?ver=${encodeURIComponent(ver)}`;
    this._iframe.style.cssText = 'width:100%;height:100%;border:0;display:block;';
    this._iframe.addEventListener('load', () => this._sendAuth());
    this.appendChild(this._iframe);
  }

  set hass(hass) {
    this._hass = hass;
    this._sendAuth();
  }

  get hass() {
    return this._hass;
  }

  // Forward the auth data to the Vue app inside the iframe
  // so it can establish its own WebSocket connection.
  _sendAuth() {
    if (!this._iframe || !this._iframe.contentWindow || !this._hass) return;
    const auth = this._hass.auth;
    if (!auth || !auth.data) return;
    this._iframe.contentWindow.postMessage(
      {
        type: 'vue-panel:auth',
        hassUrl: auth.data.hassUrl || location.origin,
        access_token: auth.data.access_token,
        expires: auth.data.expires,
        // HA UI language — always takes priority over any in-app preference
        language:
          (this._hass.locale && this._hass.locale.language) || this._hass.language || '',
      },
      location.origin
    );
  }
}

if (!customElements.get('vue-panel')) {
  customElements.define('vue-panel', VuePanelElement);
}
