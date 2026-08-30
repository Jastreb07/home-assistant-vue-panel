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
