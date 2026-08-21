import type { ResponsiveVisibility } from '@/core/ui/responsiveCss'
import type { VisibleIf } from './cardConditions'
import type { CardAction, CardActionValue, CardGesture } from '@/core/ui/cardActions'

export type PortableCardArea = 'dashboard' | 'sidebar' | 'header' | 'bottom'
export type PortableCardCapability =
  | 'entity:read'
  | 'entity:subscribe'
  | 'icon:render'
  | 'service:call'
  | 'navigation:read'
  | 'navigation:write'
  | 'dashboard:context'
  | 'shell:events'

export type PortableCardVariableType =
  | 'action'
  | 'entity'
  | 'icon'
  | 'view'
  | 'select'
  | 'string'
  | 'number'
  | 'boolean'
  | 'list'

export interface PortableCardVariable {
  key: string
  label: string
  /** Settings box this variable is shown in — ungrouped variables share one box */
  group?: string
  /** Conditions on other variables that decide whether this one is offered */
  visibleIf?: VisibleIf
  type: PortableCardVariableType
  required: boolean
  /** `action` variables default to one action per gesture instead of a scalar */
  default?: string | number | boolean | Partial<Record<CardGesture, CardActionValue>>
  domain?: string
  options?: string[]
  optionLabels?: Record<string, string>
  min?: number
  max?: number
  step?: number
  /** `list` only: the scalar fields repeated for every entry */
  itemFields?: PortableCardVariable[]
  /** `list` only: entries can be indented to build a hierarchy */
  nestable?: boolean
  /** `action` only: gestures the card reacts to — all three by default */
  gestures?: CardGesture[]
  /** `action` only: actions those gestures may use — all of them by default */
  actions?: CardAction[]
}

/**
 * Language tag of a card catalog: a card may ship any language, not only the
 * two the panel UI itself speaks. Examples: `en`, `de`, `pt-BR`.
 */
export type CardLanguage = string

/**
 * The `<script data-vue-panel-translation>` block of a card: one flat catalog
 * of `translation.*` keys per language plus the language single texts fall
 * back to when they are missing.
 */
export interface CardTranslations {
  fallback: CardLanguage
  languages: Record<CardLanguage, Record<string, string>>
}

export interface PortableCardMetadata {
  format: 'vue-panel-card'
  formatVersion: 2
  apiVersion: 1
  manufacturer: string
  cardName: string
  name: string
  description: string
  icon: string
  group: string
  areas: PortableCardArea[]
  capabilities: PortableCardCapability[]
  defaultSize: { cols: number; rows: number; width: number; height: number }
  defaultResponsive: ResponsiveVisibility
  fullRow: boolean
  variables: PortableCardVariable[]
}

export interface PortableCardCatalogEntry extends PortableCardMetadata {
  translations: CardTranslations
  type: string
  source: 'bundled' | 'local'
  writable: boolean
  contentHash: string
  resourceUrl: string
  sizeBytes: number
}

export interface PortableCardDocument extends PortableCardCatalogEntry {
  document: string
  html: string
  css: string
  javascript: string
}
