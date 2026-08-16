/** Data model of the dashboard configuration — the single source of truth, no YAML. */

export type ViewLayout = 'sections' | 'tiles' | 'panel' | 'sidebar' | 'grid'

export interface CardConfig {
  id: string
  /** Reference to CardManifest.type */
  type: string
  /** Card-specific settings according to the manifest schema */
  config: Record<string, unknown>
  size?: { cols: number; rows: number }
}

export interface SectionConfig {
  id: string
  title?: string
  icon?: string
  cards: CardConfig[]
}

export interface ViewConfig {
  id: string
  title: string
  icon: string
  layout: ViewLayout
  layoutOptions?: Record<string, unknown>
  /** Subviews do not appear in the navigation and have a back button */
  subview?: boolean
  /** CSS background of the view area, e.g. '#1a2b3c' or 'url(...) center/cover' */
  background?: string
  sections: SectionConfig[]
}

/** Configuration of the navigation (SideNav on wide screens, BottomNav on narrow). */
export interface NavConfig {
  /** Cards rendered inside the navigation — manifest must allow the 'nav' area */
  cards: CardConfig[]
  /** Built-in clock above the view list (SideNav only) */
  showClock: boolean
  /** Cards above or below the view list */
  cardsPosition: 'top' | 'bottom'
  /** SideNav width in px */
  width: number
}

export interface DashboardSettings {
  theme: 'dark' | 'light' | 'auto'
  /** Component theme under src/theme/<name>/ — 'default' is built in */
  uiTheme: string
  /** Screensaver after N minutes idle — 0 disables it */
  screensaverMinutes: number
  /** Return to the first view after N seconds idle — 0 disables it */
  autoReturnSeconds: number
}

export interface DashboardConfig {
  version: 1
  settings?: Partial<DashboardSettings>
  nav?: Partial<NavConfig>
  views: ViewConfig[]
}
