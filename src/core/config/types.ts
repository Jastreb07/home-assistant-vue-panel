import type { BoxValue } from '@/core/ui/boxInput'
import type { ResponsiveVisibility } from '@/core/ui/responsiveCss'

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
  /** Global bars on this view — the right sidebar is off unless enabled */
  showSidebarLeft?: boolean
  showSidebarRight?: boolean
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
  | 'list'

export interface CustomCardVariable {
  id: string
  key: string
  label: string
  /** Settings box this variable is shown in — ungrouped variables share one box */
  group?: string
  type: CustomCardVariableType
  required: boolean
  domain?: string
  default?: string | number | boolean
  options?: string[]
  optionLabels?: Record<string, string>
  min?: number
  max?: number
  step?: number
  /** `list` only: the scalar fields repeated for every entry */
  itemFields?: Array<Omit<CustomCardVariable, 'id'>>
  /** `list` only: entries can be indented to build a hierarchy */
  nestable?: boolean
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

export type BarPosition = 'sidebar-left' | 'sidebar-right' | 'header' | 'bottom'

/** Alignment of the cards inside a bar column — 'stretch' fills the axis. */
export type BarAlign = 'start' | 'center' | 'end' | 'stretch'

/**
 * One column of a bar. Columns run along the bar: left to right in the header
 * and bottom bars, top to bottom in the sidebars.
 */
/**
 * How a column is sized along the bar axis:
 * 'fit' shrinks to its cards, 'full' shares the remaining space evenly with
 * other 'full' columns, 'fixed' uses the explicit `size` in px.
 */
export type BarSizeMode = 'fit' | 'full' | 'fixed'

export interface BarColumn {
  id: string
  /** How the column is sized along the bar — defaults to 'full' */
  sizeMode?: BarSizeMode
  /** Fixed size along the bar in px — only meaningful when sizeMode is 'fixed' */
  size?: number
  /** Space inside the column */
  padding?: BoxValue
  /** Space around the column */
  margin?: BoxValue
  /** Where the cards sit along the bar */
  align?: BarAlign
  /** Where the cards sit across the bar */
  crossAlign?: BarAlign
  cards: CardConfig[]
}

/** A global bar: an engine-rendered container that hosts columns of cards. */
export interface BarEntry {
  id: string
  /** Sidebar width in px — bar height in px for the header and bottom bars */
  size: number
  /** Header and bottom bars only: span the view column or the whole app */
  placement?: 'view' | 'full'
  /** Custom CSS for the bar container, scoped via [data-vp-card] */
  css?: string
  /**
   * Screen sizes this bar is rendered on, with the breakpoints that separate
   * them. Both sidebars are desktop-only by default.
   */
  visibility?: ResponsiveVisibility
  columns: BarColumn[]
}

export type BarConfig = Record<BarPosition, BarEntry>

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
