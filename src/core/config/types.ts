import type { BoxValue } from '@/core/ui/boxInput'

export type ViewLayout = 'sections' | 'flex' | 'panel' | 'sidebar' | 'grid'
export type CardOrientation = 'auto' | 'vertical' | 'horizontal'
export type ViewWidth = 'default' | 'full'
export type ViewAlign = 'left' | 'center' | 'right'

export interface CardConfig {
  id: string
  type: string
  config: Record<string, unknown>
  css?: string
  size?: { cols?: number; rows?: number; width?: number; height?: number }
}

export interface SectionConfig {
  id: string
  columnSpan?: number
  cardOrientation?: CardOrientation
  cardsPerRow?: number
  contentAlign?: ViewAlign
  width?: number
  padding?: BoxValue
  margin?: BoxValue
  cards: CardConfig[]
}

export interface ViewConfig {
  id: string
  title: string
  icon: string
  path?: string
  layout: ViewLayout
  layoutOptions?: Record<string, unknown>
  subview?: boolean
  background?: string
  showSidebar?: boolean
  showHeader?: boolean
  showBottom?: boolean
  padding?: BoxValue
  margin?: BoxValue
  width?: ViewWidth
  align?: ViewAlign
  sections: SectionConfig[]
}

export type CustomCardVariableType =
  | 'entity'
  | 'string'
  | 'number'
  | 'boolean'
  | 'icon'
  | 'view'
  | 'select'

export interface CustomCardVariable {
  id: string
  key: string
  label: string
  type: CustomCardVariableType
  required: boolean
  domain?: string
  default?: string | number | boolean
  options?: string[]
  optionLabels?: Record<string, string>
  min?: number
  max?: number
  step?: number
}

export interface CustomCardDefinition {
  id: string
  format: 'vue-panel-card'
  formatVersion: 2
  apiVersion: 1
  manufacturer: string
  cardName: string
  name: string
  description: string
  icon: string
  group: string
  areas: Array<'dashboard' | 'sidebar' | 'header' | 'bottom'>
  capabilities: Array<
    | 'entity:read'
    | 'entity:subscribe'
    | 'icon:render'
    | 'service:call'
    | 'navigation:read'
    | 'navigation:write'
    | 'dashboard:context'
    | 'shell:events'
  >
  html: string
  css: string
  javascript: string
  variables: CustomCardVariable[]
  defaultSize: { cols: number; rows: number; width: number; height: number }
  defaultResponsive: {
    mobile: boolean
    tablet: boolean
    desktop: boolean
    mobileMax: number
    tabletMax: number
  }
  fullRow: boolean
  contentHash?: string
  writable?: boolean
  source?: 'bundled' | 'local'
}

export type BarPosition = 'sidebar' | 'header' | 'bottom'
export type BarConfig = Record<BarPosition, CardConfig>

export interface DashboardSettings {
  theme: 'dark' | 'light' | 'auto'
  uiTheme: string
  screensaverMinutes: number
  autoReturnSeconds: number
  customCss?: string
}

export interface DashboardConfig {
  format: 'vue-panel-dashboard'
  formatVersion: 1
  revision: number
  settings?: Partial<DashboardSettings>
  bars?: Partial<BarConfig>
  views: ViewConfig[]
}
