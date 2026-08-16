import { watchEffect } from 'vue'
import { useDashboardStore } from '@/core/config/dashboardStore'

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
  }

  media.addEventListener('change', apply)
  watchEffect(apply)
}
