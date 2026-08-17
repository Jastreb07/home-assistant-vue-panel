/** Data model of the dashboard configuration — the single source of truth, no YAML. */

import type { BoxValue } from '@/core/ui/boxInput'

export type ViewLayout = 'sections' | 'flex' | 'panel' | 'sidebar' | 'grid'

/** How the cards of a section flow — 'auto' keeps the layout's own grid. */
export type CardOrientation = 'auto' | 'vertical' | 'horizontal'

/** Content width of a view — 'full' drops the layout's max-width. */
export type ViewWidth = 'default' | 'full'

/** Horizontal alignment of content that does not fill its container. */
export type ViewAlign = 'left' | 'center' | 'right'

export interface CardConfig {
  id: string
  /** Reference to CardManifest.type */
  type: string
  /** Card-specific settings according to the manifest schema */
  config: Record<string, unknown>
  /** Per-card custom CSS override, scoped to this card instance via [data-vp-card] */
  css?: string
  /** cols/rows: grid span (grid layouts) — width/height: fixed px size (flex layout) */
  size?: { cols?: number; rows?: number; width?: number; height?: number }
}

/** Headings are ordinary cards of type 'section-title' — a section itself has no title. */
export interface SectionConfig {
  id: string
  /** Width in grid columns (sections layout) — clamped to layoutOptions.maxColumns */
  columnSpan?: number
  /** Direction the cards are arranged in */
  cardOrientation?: CardOrientation
  /** Horizontal alignment of the cards inside the section (flex rows) */
  contentAlign?: ViewAlign
  /** Fixed section width in px (flex layout) — unset means full width */
  width?: number
  /** Space inside the section box */
  padding?: BoxValue
  /** Space around the section box */
  margin?: BoxValue
  cards: CardConfig[]
}

export interface ViewConfig {
  id: string
  title: string
  icon: string
  /** Hierarchical URL path of the view — falls back to the id when unset */
  path?: string
  layout: ViewLayout
  layoutOptions?: Record<string, unknown>
  /** CSS background of the view area, e.g. '#1a2b3c' or 'url(...) center/cover' */
  background?: string
  /** Show the sidebar on this view (default: true) */
  showSidebar?: boolean
  /** Show the header bar on this view (default: false) */
  showHeader?: boolean
  /** Space inside the view area, around the layout */
  padding?: BoxValue
  /** Space around the layout itself */
  margin?: BoxValue
  /** 'full' lets the layout use the whole width instead of its max-width */
  width?: ViewWidth
  /** Horizontal position of the layout inside the view area (default: center) */
  align?: ViewAlign
  sections: SectionConfig[]
}

/** The three card slots of the sidebar, top to bottom. */
export type NavSlot = 'top' | 'center' | 'bottom'

/** Alignment of the center slot content — 'stretch' fills the width. */
export type NavAlign = 'start' | 'center' | 'end' | 'stretch'

/** Configuration of the navigation (SideNav on wide screens, BottomNav on narrow). */
export interface NavConfig {
  /** Cards per slot — the manifest must allow the matching `sidebar_*` area */
  slots: Record<NavSlot, CardConfig[]>
  /** SideNav width in px */
  width: number
  /** Where the center slot content sits inside the free space */
  centerAlign: { vertical: NavAlign; horizontal: NavAlign }
}

/** The three card slots of the header bar, left to right. */
export type HeaderSlot = 'left' | 'center' | 'right'

/** The header bar — the horizontal counterpart of the sidebar. */
export interface HeaderConfig {
  /** Cards per slot — the manifest must allow the matching `header_*` area */
  slots: Record<HeaderSlot, CardConfig[]>
  /** Bar height in px */
  height: number
  /** Where the center slot content sits inside the free space */
  centerAlign: { vertical: NavAlign; horizontal: NavAlign }
}

export interface DashboardSettings {
  theme: 'dark' | 'light' | 'auto'
  /** Component theme under src/theme/<name>/ — 'default' is built in */
  uiTheme: string
  /** Screensaver after N minutes idle — 0 disables it */
  screensaverMinutes: number
  /** Return to the first view after N seconds idle — 0 disables it */
  autoReturnSeconds: number
  /** Global CSS override, replaces the theme's main.css when set */
  customCss?: string
}

export interface DashboardConfig {
  version: 1
  settings?: Partial<DashboardSettings>
  nav?: Partial<NavConfig>
  header?: Partial<HeaderConfig>
  views: ViewConfig[]
}
