import { onScopeDispose, readonly, ref, type Ref } from 'vue'

const currentPath = ref(readPath())
let consumerCount = 0

function normalizePath(path: string): string {
  return path.trim().replace(/^#?\/+|\/+$/g, '')
}

function readPath(): string {
  if (typeof window === 'undefined') return ''
  return normalizePath(window.location.hash)
}

function syncPath(): void {
  currentPath.value = readPath()
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

/** Navigate to a dashboard view through the hash router. */
export function navigatePanel(path: string): void {
  if (typeof window === 'undefined') return

  const normalized = normalizePath(path)
  if (currentPath.value === normalized) return

  currentPath.value = normalized
  window.location.hash = normalized ? `#/${normalized}` : '#/'
}
