import { watchEffect } from 'vue'
import { useDashboardStore } from '@/core/config/dashboardStore'

const STORAGE_KEY = 'vue-panel:color-scheme'

function readStoredScheme(): 'dark' | 'light' | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'dark' || value === 'light' ? value : null
  } catch {
    return null
  }
}

/**
 * Apply the last known color scheme before the app mounts, so the connection
 * overlay already uses the dashboard's theme instead of flashing dark while
 * the settings are still loading. Falls back to the OS preference.
 */
export function initializeColorScheme(): void {
  const stored = readStoredScheme()
  const resolved = stored
    ?? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
  document.documentElement.dataset.theme = resolved
}

/**
 * Applies the configured theme ('dark' | 'light' | 'auto') to <html>.
 * 'auto' follows the OS preference via prefers-color-scheme.
 */
export function useTheme() {
  const store = useDashboardStore()
  const media = window.matchMedia('(prefers-color-scheme: light)')

  function apply() {
    const theme = store.settings.theme
    const resolved = theme === 'auto' ? (media.matches ? 'light' : 'dark') : theme
    document.documentElement.dataset.theme = resolved
    try {
      localStorage.setItem(STORAGE_KEY, resolved)
    } catch {
      // Private browsing or blocked storage: only the early paint fallback is lost.
    }
  }

  media.addEventListener('change', apply)
  watchEffect(apply)
}
