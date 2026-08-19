import type { ResponsiveVisibility } from '@/core/ui/responsiveCss'

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
  | 'entity'
  | 'icon'
  | 'view'
  | 'select'
  | 'string'
  | 'number'
  | 'boolean'

export interface PortableCardVariable {
  key: string
  label: string
  type: PortableCardVariableType
  required: boolean
  default?: string | number | boolean
  domain?: string
  options?: string[]
  optionLabels?: Record<string, string>
  min?: number
  max?: number
  step?: number
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
