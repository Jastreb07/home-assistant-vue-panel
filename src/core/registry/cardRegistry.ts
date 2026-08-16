import { defineAsyncComponent, type Component } from 'vue'

/**
 * Where a card may be placed: the dashboard views or one of the
 * three sidebar slots (top = next to the clock, center, bottom).
 */
export type CardArea =
  | 'dashboard'
  | 'sidebar_top'
  | 'sidebar_center'
  | 'sidebar_bottom'
  | 'header_left'
  | 'header_center'
  | 'header_right'

/**
 * Areas a card can ship default CSS for. 'default' covers the dashboard
 * and acts as the fallback for every area without its own entry.
 */
export type CardCssArea = 'default' | Exclude<CardArea, 'dashboard'>

/** Per-area default CSS of a card — assign one string to several keys to share it. */
export type CardCssMap = Partial<Record<CardCssArea, string>>

/** Card areas map 1:1 to CSS areas, except the dashboard which uses 'default'. */
export function cssAreaOf(area: CardArea): CardCssArea {
  return area === 'dashboard' ? 'default' : area
}

/** Field types from which the editor auto-generates config forms. */
export interface CardSchemaField {
  type: 'entity' | 'string' | 'number' | 'boolean' | 'select' | 'view' | 'icon'
  /** i18n key for the field label, e.g. 'cards.light.entity' */
  label: string
  /** For type 'entity': restrict to a domain, e.g. 'light' */
  domain?: string
  /** For type 'select' */
  options?: string[]
  optional?: boolean
  default?: unknown
}

export interface CardManifest {
  /** Unique type, referenced in the dashboard config */
  type: string
  /** i18n key for the display name in the card picker, e.g. 'cards.light.name' */
  name: string
  /** mdi icon, e.g. 'mdi:lightbulb' */
  icon: string
  /** Lazy import of the card component */
  component: () => Promise<{ default: Component }>
  /** Config schema → auto-generated editor form */
  schema?: Record<string, CardSchemaField>
  /**
   * Optional custom editor, rendered above the generated form for
   * settings a schema cannot express (e.g. the menu item tree).
   * Receives `modelValue` (the draft config) and emits `update:modelValue`.
   */
  editor?: () => Promise<{ default: Component }>
  defaultSize?: { cols: number; rows: number }
  /**
   * Areas the card can be placed in — list every area it suits, e.g.
   * `areas: ['dashboard', 'sidebar_top', 'sidebar_bottom']`.
   * Defaults to `['dashboard']`.
   */
  areas?: CardArea[]
  /**
   * Default CSS per area, applied unless the card instance overrides it.
   * `default` is the fallback for areas without their own entry:
   * `css: { default: BARE, sidebar_top: BARE, header_left: BARE }`.
   */
  css?: CardCssMap
}

/** Only for type safety + autocomplete in the manifest.ts files. */
export function defineCard(manifest: CardManifest): CardManifest {
  return manifest
}

// ⭐ Auto-discovery: every src/cards/<name>/manifest.ts is registered
// automatically — never register manually here!
const modules = import.meta.glob<{ default: CardManifest }>(
  '../../cards/*/manifest.ts',
  { eager: true },
)

export const cardRegistry: Record<string, CardManifest> = Object.fromEntries(
  Object.values(modules).map((m) => [m.default.type, m.default]),
)

// type → folder name under src/cards/ (folder may differ from the type)
const cardDirs: Record<string, string> = Object.fromEntries(
  Object.entries(modules).map(([path, m]) => [m.default.type, path.split('/').at(-2)!]),
)

// Raw sources of all card SFCs (lazy) — used to show a card's default CSS
const rawCardSources = import.meta.glob<string>('../../cards/*/*.vue', {
  query: '?raw',
  import: 'default',
})

/**
 * The CSS a card ships for an area — the area's own entry, else the
 * manifest's 'default'. Empty when the card declares none.
 */
export function cardAreaCss(type: string, area: CardCssArea = 'default'): string {
  const css = cardRegistry[type]?.css
  return css?.[area] ?? css?.default ?? ''
}

/**
 * The default CSS shown in the editor's CSS tab: what the manifest
 * declares for the area, or — for cards without a css map — the
 * <style> blocks of the card's .vue files as a starting point.
 */
export async function cardDefaultCss(type: string, area: CardCssArea = 'default'): Promise<string> {
  const declared = cardAreaCss(type, area)
  if (declared) return declared
  const dir = cardDirs[type]
  if (!dir) return ''
  const prefix = `../../cards/${dir}/`
  const parts: string[] = []
  for (const [path, load] of Object.entries(rawCardSources)) {
    if (!path.startsWith(prefix)) continue
    const source = await load()
    for (const match of source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
      const css = match[1].trim()
      if (css) parts.push(css)
    }
  }
  return parts.join('\n\n')
}

/** Cards offered for an area — 'dashboard' is the default when unset. */
export function cardsForArea(area: CardArea): CardManifest[] {
  return Object.values(cardRegistry).filter((m) => (m.areas ?? ['dashboard']).includes(area))
}

const editorCache = new Map<string, Component>()

/** Resolve a card's custom editor component, if it has one. */
export function resolveCardEditor(type: string): Component | null {
  const loader = cardRegistry[type]?.editor
  if (!loader) return null
  if (!editorCache.has(type)) editorCache.set(type, defineAsyncComponent(loader))
  return editorCache.get(type)!
}

const componentCache = new Map<string, Component>()

/** Resolve a card component by type (lazy, cached). */
export function resolveCardComponent(type: string): Component | null {
  const manifest = cardRegistry[type]
  if (!manifest) return null
  if (!componentCache.has(type)) {
    componentCache.set(type, defineAsyncComponent(manifest.component))
  }
  return componentCache.get(type)!
}
