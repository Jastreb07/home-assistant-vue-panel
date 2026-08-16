import { defineAsyncComponent, type Component } from 'vue'
import { useDashboardStore } from '@/core/config/dashboardStore'

/**
 * Theme system for UI components (Nuxt-UI-like).
 *
 * Structure: src/theme/<themeName>/
 *   main.css                — global stylesheet of the theme (optional)
 *   <ComponentName>/
 *     index.vue  — the component (optional in custom themes)
 *     style.css  — the component styles (plain CSS, namespaced `vp-*` classes)
 *
 * Resolution rules:
 *   1. The default theme's style.css is always loaded first.
 *   2. If the active theme has a style.css for the component, it is loaded
 *      on top (CSS-only themes just restyle the default markup).
 *   3. If the active theme has an index.vue, it replaces the default
 *      component — otherwise the default theme's index.vue is used.
 *
 * Components never import their own CSS; the registry loads it. Styles use
 * namespaced classes (e.g. `.vp-card`) instead of Vue scoped CSS so that
 * CSS-only themes can override them.
 */

const DEFAULT_THEME = 'default'

// Auto-discovery across all themes (lazy)
const vueModules = import.meta.glob<{ default: Component }>('./*/*/index.vue')
const cssModules = import.meta.glob('./*/*/style.css')
const globalCssModules = import.meta.glob('./*/main.css')

/** All theme names found under src/theme/ */
export function availableThemes(): string[] {
  const names = new Set<string>()
  for (const key of [
    ...Object.keys(vueModules),
    ...Object.keys(cssModules),
    ...Object.keys(globalCssModules),
  ]) {
    const theme = key.split('/')[1]
    if (theme) names.add(theme)
  }
  return [...names].sort((a, b) => (a === DEFAULT_THEME ? -1 : b === DEFAULT_THEME ? 1 : a.localeCompare(b)))
}

function getActiveTheme(): string {
  try {
    return useDashboardStore().settings.uiTheme || DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

/**
 * Load the global stylesheet(s). The default theme's main.css is always
 * loaded (fallback); the active theme's main.css is loaded on top of it.
 * Safe to call multiple times — modules are cached by the bundler.
 */
export async function loadGlobalStyles(): Promise<void> {
  await globalCssModules[`./${DEFAULT_THEME}/main.css`]?.()
  const theme = getActiveTheme()
  if (theme !== DEFAULT_THEME) await globalCssModules[`./${theme}/main.css`]?.()
}

async function loadStyles(theme: string, name: string): Promise<void> {
  await cssModules[`./${DEFAULT_THEME}/${name}/style.css`]?.()
  if (theme !== DEFAULT_THEME) await cssModules[`./${theme}/${name}/style.css`]?.()
}

const cache = new Map<string, Component>()

/**
 * Resolve a themed UI component by name, e.g. themed('Card').
 * Falls back to the default theme when the active theme does not
 * provide the component (or provides only a style.css).
 */
export function themed(name: string): Component {
  if (!cache.has(name)) {
    cache.set(
      name,
      defineAsyncComponent(async () => {
        const theme = getActiveTheme()
        await loadStyles(theme, name)
        const loader =
          vueModules[`./${theme}/${name}/index.vue`] ??
          vueModules[`./${DEFAULT_THEME}/${name}/index.vue`]
        if (!loader) throw new Error(`[vue-panel] Unknown themed component: ${name}`)
        return (await loader()).default
      }),
    )
  }
  return cache.get(name)!
}
