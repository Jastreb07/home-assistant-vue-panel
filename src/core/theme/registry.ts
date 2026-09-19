import { defineAsyncComponent, readonly, ref, type Component, type Ref } from 'vue'
import { useDashboardStore } from '@/core/config/dashboardStore'
import { getTheme, listThemes } from '@/core/ha/themeApi'
import { themeComponentApi } from './componentApi'
import type { ThemeCatalogEntry, ThemeDocument } from './themeTypes'

/**
 * Runtime theme system.
 *
 * Themes are plain file packages managed by the integration — they are never
 * compiled into the engine. A theme is a directory holding a single `main.css`
 * (all styles plus the metadata header) and optional flat `<Name>.js`
 * component modules. The bundled `default` theme ships with the integration;
 * user themes live under `<config>/vue-panel/themes/<name>/`.
 *
 * Resolution rules:
 *   1. The default theme's main.css is always injected first.
 *   2. The active theme's main.css is injected on top (CSS-only themes just
 *      restyle the default markup).
 *   3. A component resolves to the active theme's `<Name>.js` when present,
 *      otherwise to the default theme's file.
 *
 * A component module exports a factory as its default export:
 *   `export default (api) => ({ ...component options with template string })`
 * and may export `styles` (a file name inside the theme) when its CSS is not
 * part of main.css. Templates are compiled at runtime.
 */

const DEFAULT_THEME = 'default'
const CSS_CACHE_KEY = 'vue-panel:theme-css'

let catalog: ThemeCatalogEntry[] = []
const documents = new Map<string, ThemeDocument>()
let activeName = DEFAULT_THEME

let readyResolve: () => void
const ready = new Promise<void>((resolve) => { readyResolve = resolve })
const themesLoaded = ref(false)

/** Reactive flag: true once the catalog and the active theme are loaded. */
export function useThemesLoaded(): Readonly<Ref<boolean>> {
  return readonly(themesLoaded)
}

function styleElement(id: string): HTMLStyleElement {
  let el = document.getElementById(id) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = id
    document.head.appendChild(el)
  }
  return el
}

/** A stray BOM would become part of the first CSS selector and disable it. */
function sanitizeCss(css: string): string {
  return css.replace(/\uFEFF/g, '')
}

/**
 * Paint the last known theme CSS before the app mounts, so the loading
 * screen already looks like the dashboard instead of flashing unstyled.
 */
export function bootstrapThemeCss(): void {
  try {
    const cached = localStorage.getItem(CSS_CACHE_KEY)
    if (cached) styleElement('vp-theme-base').textContent = sanitizeCss(cached)
  } catch {
    // Private browsing: only the early paint fallback is lost.
  }
}

function requestedTheme(): string {
  try {
    return useDashboardStore().settings.uiTheme || DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

/**
 * Load the theme catalog and the active theme after the dashboard settings
 * are known. Incompatible or missing themes fall back to the default theme.
 */
export async function syncThemes(): Promise<void> {
  catalog = await listThemes()

  let name = requestedTheme()
  const entry = catalog.find((theme) => theme.name === name)
  if (!entry) {
    if (name !== DEFAULT_THEME) console.warn(`[vue-panel] Theme "${name}" is not installed — using the default theme.`)
    name = DEFAULT_THEME
  } else if (!entry.compatible) {
    console.warn(
      `[vue-panel] Theme "${name}" requires Vue Panel ${entry.requiresVuePanel} — using the default theme.`,
    )
    name = DEFAULT_THEME
  }
  activeName = name

  const defaultDocument = await getTheme(DEFAULT_THEME)
  documents.set(DEFAULT_THEME, defaultDocument)
  if (name !== DEFAULT_THEME) documents.set(name, await getTheme(name))

  const base = sanitizeCss(defaultDocument.files['main.css'] ?? '')
  const active = name === DEFAULT_THEME ? '' : sanitizeCss(documents.get(name)?.files['main.css'] ?? '')
  styleElement('vp-theme-base').textContent = base
  styleElement('vp-theme-active').textContent = active
  try {
    localStorage.setItem(CSS_CACHE_KEY, `${base}\n${active}`)
  } catch {
    // Ignore blocked storage — the next boot just paints unthemed.
  }

  readyResolve()
  themesLoaded.value = true
}

/** All installed themes with their metadata — for the settings dialog. */
export async function themeCatalog(): Promise<ThemeCatalogEntry[]> {
  await ready
  return catalog
}

/** The resolved active theme (after compatibility fallback). */
export function activeThemeName(): string {
  return activeName
}

/**
 * Raw main.css of the active theme — the starting point for the dashboard's
 * global CSS editor.
 */
export async function themeMainCss(): Promise<string> {
  await ready
  const active = documents.get(activeName) ?? documents.get(DEFAULT_THEME)
  return active?.files['main.css'] ?? ''
}

/** Evaluate one runtime component module from its source text. */
async function importModule(source: string): Promise<Record<string, unknown>> {
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
  try {
    return await import(/* @vite-ignore */ url) as Record<string, unknown>
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function resolveComponent(name: string): Promise<Component> {
  await ready
  const file = `${name}.js`
  const activeDocument = documents.get(activeName)
  const doc = activeDocument?.files[file] !== undefined
    ? activeDocument
    : documents.get(DEFAULT_THEME)
  const source = doc?.files[file]
  if (!doc || source === undefined) throw new Error(`[vue-panel] Unknown themed component: ${name}`)

  const mod = await importModule(source)
  const factory = mod.default
  if (typeof factory !== 'function') {
    throw new Error(`[vue-panel] Theme component "${name}" has no factory default export.`)
  }

  // Optional dedicated stylesheet(s) outside main.css
  const styles = mod.styles
  for (const styleFile of typeof styles === 'string' ? [styles] : Array.isArray(styles) ? styles : []) {
    const css = doc.files[String(styleFile)]
    if (css !== undefined) styleElement(`vp-theme-style-${doc.name}-${String(styleFile)}`).textContent = sanitizeCss(css)
  }

  return factory(themeComponentApi()) as Component
}

const cache = new Map<string, Component>()

/**
 * Resolve a themed UI component by name, e.g. themed('Card'). Falls back to
 * the default theme when the active theme does not provide the component.
 */
export function themed(name: string): Component {
  let component = cache.get(name)
  if (!component) {
    component = defineAsyncComponent(() => resolveComponent(name))
    cache.set(name, component)
  }
  return component
}
