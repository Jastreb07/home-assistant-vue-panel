/**
 * Asks the surrounding Home Assistant page to collapse its own sidebar.
 *
 * The engine runs in an iframe and cannot touch the host document, so the
 * request travels through the same postMessage channel as the route mirror
 * (see `panelNavigation.ts`); the loader element applies it. Outside the
 * panel — the dev server, the card preview — there is no host to ask and
 * the call is a no-op.
 */

const embedded = typeof window !== 'undefined' && window.parent !== window

/** Last state sent to the host, so an unchanged value costs no message. */
let reported: boolean | null = null

export function reportSidebarHidden(hidden: boolean): void {
  if (!embedded || reported === hidden) return
  reported = hidden
  window.parent.postMessage({ type: 'vue-panel:sidebar', hidden }, location.origin)
}

/** Home Assistant destinations a card may ask the host page to open. */
export type HostTarget = 'settings' | 'notifications'

/**
 * Open one of Home Assistant's own screens. Only the host page can do this:
 * its config panel lies outside the panel route, and the notification drawer
 * is a component of the HA shell, not of this engine.
 */
export function openHostTarget(target: HostTarget): void {
  if (!embedded) {
    console.warn(`[vue-panel] Cannot open "${target}" outside the Home Assistant panel.`)
    return
  }
  window.parent.postMessage({ type: 'vue-panel:host-open', target }, location.origin)
}

/** Ask Home Assistant to open its native more-info dialog for an entity. */
export function openHostMoreInfo(entityId: string): void {
  if (!embedded) {
    console.warn('[vue-panel] Cannot open Home Assistant more-info outside the panel.')
    return
  }
  window.parent.postMessage({ type: 'vue-panel:ha-more-info', entityId }, location.origin)
}

/**
 * Follow a link that leaves the dashboard. A new tab could be opened from
 * here, but the same-tab case must replace the whole page rather than just
 * the panel iframe — so both go through the host for consistent behaviour.
 */
export function openHostUrl(url: string, newTab: boolean): void {
  if (!embedded) {
    window.open(url, newTab ? '_blank' : '_self', 'noopener')
    return
  }
  window.parent.postMessage({ type: 'vue-panel:open-url', url, newTab }, location.origin)
}

/**
 * Reload the whole page, not just the panel iframe: the engine bundle and
 * the loader are versioned separately, and only a top-level reload picks up
 * both. Falls back to a local reload outside the panel.
 */
export function reloadHost(): void {
  if (!embedded) {
    window.location.reload()
    return
  }
  window.parent.postMessage({ type: 'vue-panel:reload' }, location.origin)
}

/**
 * Open a dashboard view in a new tab. Only the host knows the panel's URL
 * prefix, and only its URL loads the full Home Assistant shell — the engine's
 * own document would open without it.
 */
export function openHostView(path: string): void {
  if (!embedded) {
    window.open(`${location.pathname}#/${path}`, '_blank', 'noopener')
    return
  }
  window.parent.postMessage({ type: 'vue-panel:open-view', path }, location.origin)
}
