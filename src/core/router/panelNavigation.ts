import { onScopeDispose, readonly, ref, type Ref } from 'vue'

const currentPath = ref(readPath())
let consumerCount = 0

/** In production the engine runs inside the loader iframe of the HA panel. */
const embedded = typeof window !== 'undefined' && window.parent !== window
/** Last path exchanged with the host — guards against ping-pong updates. */
let hostPath: string | null = null

function normalizePath(path: string): string {
  return path.trim().replace(/^#?\/+|\/+$/g, '')
}

function readPath(): string {
  if (typeof window === 'undefined') return ''
  return normalizePath(window.location.hash)
}

/**
 * Mirror the active view into the browser address bar of the surrounding Home
 * Assistant page, so `/<panel>/<view-path>` stays shareable and bookmarkable.
 */
function reportPathToHost(path: string, replace: boolean): void {
  if (!embedded || hostPath === path) return
  // Before the host handed over its route, an empty path says nothing — it must
  // never overwrite a deep link the user opened.
  if (hostPath === null && !path) return
  hostPath = path
  window.parent.postMessage({ type: 'vue-panel:navigate', path, replace }, location.origin)
}

function syncPath(): void {
  currentPath.value = readPath()
  reportPathToHost(currentPath.value, false)
}

/**
 * Adopt a path the host supplied — a deep link, a browser back step or the
 * initial panel route. The engine must not echo it back to the host.
 */
export function applyHostRoutePath(path: string): void {
  if (typeof window === 'undefined') return
  const normalized = normalizePath(path)
  hostPath = normalized
  navigatePanel(normalized, { replace: true, silent: true })
}

if (embedded) {
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.origin !== location.origin || event.source !== window.parent) return
    const data = event.data as { type?: string; path?: string } | null
    if (data?.type !== 'vue-panel:route' || typeof data.path !== 'string') return
    applyHostRoutePath(data.path)
  })
}

/**
 * Exposes the current hash-router path without relying on Vue Router injection.
 * Lazy-loaded cards can therefore navigate safely inside the HA custom element.
 */
export function usePanelRoutePath(): Readonly<Ref<string>> {
  syncPath()

  if (typeof window !== 'undefined') {
    if (consumerCount === 0) window.addEventListener('hashchange', syncPath)
    consumerCount += 1

    onScopeDispose(() => {
      consumerCount = Math.max(0, consumerCount - 1)
      if (consumerCount === 0) window.removeEventListener('hashchange', syncPath)
    })
  }

  return readonly(currentPath)
}

export interface PanelNavigationOptions {
  /** Rewrite the current history entry instead of pushing a new one. */
  replace?: boolean
  /** Do not report the path back to the host page (it is the source). */
  silent?: boolean
}

/** Navigate to a dashboard view through the hash router. */
export function navigatePanel(path: string, options: PanelNavigationOptions = {}): void {
  if (typeof window === 'undefined') return

  const normalized = normalizePath(path)
  const hash = normalized ? `#/${normalized}` : '#/'
  // The hash may already be correct while only its formatting differs (e.g. '#').
  if (currentPath.value === normalized && window.location.hash === hash) {
    if (!options.silent) reportPathToHost(normalized, options.replace === true)
    return
  }

  currentPath.value = normalized
  if (!options.silent) reportPathToHost(normalized, options.replace === true)
  if (options.replace) {
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${hash}`)
    return
  }
  window.location.hash = hash
}
