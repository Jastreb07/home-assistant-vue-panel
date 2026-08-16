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
  views: ViewConfig[]
}
