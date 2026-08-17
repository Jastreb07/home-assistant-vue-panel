import { defineAsyncComponent, type Component } from 'vue'
import { NATIVE_GROUP, OTHER_GROUP, type CardGroup } from './cardGroups'
import type { BarPosition } from '@/core/config/types'
import {
  defaultResponsiveVisibility,
  withResponsiveCss,
  type ResponsiveVisibility,
} from '@/core/ui/responsiveCss'

// Re-exported so consumers have a single import site for the registry API
export { NATIVE_GROUP, OTHER_GROUP, type CardGroup }

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
  | 'bottom_left'
  | 'bottom_center'
  | 'bottom_right'

/**
 * Areas a card can ship default CSS for. 'default' covers the dashboard
 * and acts as the fallback for every area without its own entry.
 */
export type CardCssArea =
  | 'default'
  | Exclude<CardArea, 'dashboard'>
  | 'bar_sidebar'
  | 'bar_header'
  | 'bar_bottom'

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
  /** Render the label verbatim instead of treating it as an i18n key. */
  literalLabel?: boolean
  /** For type 'entity': restrict to a domain, e.g. 'light' */
  domain?: string
  /** For type 'select' */
  options?: string[]
  /** Optional i18n labels keyed by the stored select value. */
  optionLabels?: Record<string, string>
  /** Optional constraints for number fields. */
  min?: number
  max?: number
  step?: number
  optional?: boolean
  /** Explicit required marker used by dynamically generated schemas. */
  required?: boolean
  default?: unknown
}

export interface CardManifest {
  /** Unique type, referenced in the dashboard config */
  type: string
  /** i18n key for the display name in the card picker, e.g. 'cards.light.name' */
  name: string
  /** mdi icon, e.g. 'mdi:lightbulb' */
  icon: string
  /** Picker group — defaults to OTHER_GROUP when omitted */
  group?: CardGroup
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
  /** Grid span plus optional fixed fallback size for the flex layout. */
  defaultSize?: { cols: number; rows: number; width?: number; height?: number }
  /**
   * Card always occupies a full row of its section (e.g. a heading):
   * width 100 % in every layout, and no resize handle in the flex layout.
   */
  fullRow?: boolean
  /**
   * Areas the card can be placed in — list every area it suits, e.g.
   * `areas: ['dashboard', 'sidebar_top', 'sidebar_bottom']`.
   * Defaults to `['dashboard']`.
   */
  areas?: CardArea[]
  /** Shell bar positions this card can occupy. Bar-only cards stay out of the normal picker. */
  barPositions?: BarPosition[]
  /** Card-specific defaults for the CSS-backed responsive visibility editor. */
  defaultResponsive?: Partial<ResponsiveVisibility>
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

// ⭐ Auto-discovery: every src/cards/<provider>/<name>/manifest.ts is
// registered automatically — never register manually here!
const modules = import.meta.glob<{ default: CardManifest }>(
  '../../cards/**/manifest.ts',
  { eager: true },
)

export const cardRegistry: Record<string, CardManifest> = Object.fromEntries(
  Object.values(modules).map((m) => [m.default.type, m.default]),
)

// type → complete source directory (provider path included)
const cardSourceDirs: Record<string, string> = Object.fromEntries(
  Object.entries(modules).map(([path, m]) => [m.default.type, path.slice(0, path.lastIndexOf('/'))]),
)

// Raw sources of all card SFCs (lazy) — used to show a card's default CSS
const rawCardSources = import.meta.glob<string>('../../cards/**/*.vue', {
  query: '?raw',
  import: 'default',
})

/**
 * The CSS a card ships for an area — the area's own entry, else the
 * manifest's 'default'. Empty when the card declares none.
 */
export function cardAreaCss(type: string, area: CardCssArea = 'default'): string {
  const manifest = cardRegistry[type]
  const css = manifest?.css
  return applyResponsiveDefaults(manifest, css?.[area] ?? css?.default ?? '')
}

function applyResponsiveDefaults(manifest: CardManifest | undefined, css: string): string {
  if (!manifest?.defaultResponsive) return css
  const visibility: ResponsiveVisibility = {
    ...defaultResponsiveVisibility,
    ...manifest.defaultResponsive,
  }
  return withResponsiveCss(css, visibility)
}

/**
 * The default CSS shown in the editor's CSS tab: what the manifest
 * declares for the area, or — for cards without a css map — the
 * <style> blocks of the card's .vue files as a starting point.
 */
export async function cardDefaultCss(type: string, area: CardCssArea = 'default'): Promise<string> {
  const manifest = cardRegistry[type]
  const declared = manifest?.css?.[area] ?? manifest?.css?.default
  if (declared !== undefined) return applyResponsiveDefaults(manifest, declared)
  const dir = cardSourceDirs[type]
  if (!dir) return ''
  const prefix = `${dir}/`
  const parts: string[] = []
  for (const [path, load] of Object.entries(rawCardSources)) {
    if (!path.startsWith(prefix)) continue
    const source = await load()
    for (const match of source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
      const css = match[1].trim()
      if (css) parts.push(css)
    }
  }
  return applyResponsiveDefaults(manifest, parts.join('\n\n'))
}

/** Cards offered for an area — 'dashboard' is the default when unset. */
export function cardsForArea(area: CardArea): CardManifest[] {
  return Object.values(cardRegistry).filter((m) => {
    const areas = m.areas ?? (m.barPositions?.length ? [] : ['dashboard'])
    return areas.includes(area)
  })
}

/** Auto-discovered cards suitable as the outer shell bar at a position. */
export function cardsForBar(position: BarPosition): CardManifest[] {
  return Object.values(cardRegistry).filter((manifest) => manifest.barPositions?.includes(position))
}

export interface CardGroupEntry extends CardGroup {
  cards: CardManifest[]
}

/**
 * Cards of an area bundled into their groups for the picker. The native
 * group comes first, all others follow alphabetically — as do the cards
 * inside each group. Sorting uses the caller's translate function so the
 * order matches what is actually on screen.
 */
export function groupedCardsForArea(
  area: CardArea,
  translate: (key: string) => string,
  locale?: string,
): CardGroupEntry[] {
  const groups = new Map<string, CardGroupEntry>()

  for (const manifest of cardsForArea(area)) {
    const group = manifest.group ?? OTHER_GROUP
    let entry = groups.get(group.id)
    if (!entry) {
      entry = { ...group, cards: [] }
      groups.set(group.id, entry)
    }
    entry.cards.push(manifest)
  }

  const byName = (a: string, b: string) => translate(a).localeCompare(translate(b), locale)

  for (const entry of groups.values()) {
    entry.cards.sort((a, b) => byName(a.name, b.name))
  }

  return [...groups.values()].sort((a, b) => {
    if (a.id === NATIVE_GROUP.id) return b.id === NATIVE_GROUP.id ? 0 : -1
    if (b.id === NATIVE_GROUP.id) return 1
    return byName(a.label, b.label)
  })
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
