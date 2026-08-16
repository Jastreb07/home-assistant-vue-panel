import { defineAsyncComponent, type Component } from 'vue'

/**
 * Where a card may be placed: the dashboard views or one of the
 * three sidebar slots (top = next to the clock, center, bottom).
 */
export type CardArea = 'dashboard' | 'sidebar_top' | 'sidebar_center' | 'sidebar_bottom'

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
  defaultSize?: { cols: number; rows: number }
  /**
   * Areas the card can be placed in. List both to offer it everywhere:
   * `areas: ['dashboard', 'nav']`. Defaults to `['dashboard']`.
   */
  areas?: CardArea[]
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

/** Cards offered for an area — 'dashboard' is the default when unset. */
export function cardsForArea(area: CardArea): CardManifest[] {
  return Object.values(cardRegistry).filter((m) => (m.areas ?? ['dashboard']).includes(area))
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
