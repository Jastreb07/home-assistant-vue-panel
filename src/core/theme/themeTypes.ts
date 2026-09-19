/** Catalog entry of one installed theme, as reported by the integration. */
export interface ThemeCatalogEntry {
  /** Directory name — the stable identity stored in the dashboard settings. */
  name: string
  /** Display name from the main.css metadata header. */
  themeName: string
  description: string
  version: string
  author: string
  /** Minimum Vue Panel version this theme requires (empty = any). */
  requiresVuePanel: string
  /** Component names the theme overrides (flat `<Name>.js` files). */
  components: string[]
  source: 'bundled' | 'local'
  /** False when the installed Vue Panel is older than `requiresVuePanel`. */
  compatible: boolean
}

/** Full theme package: metadata plus every file keyed by its file name. */
export interface ThemeDocument extends ThemeCatalogEntry {
  files: Record<string, string>
}
