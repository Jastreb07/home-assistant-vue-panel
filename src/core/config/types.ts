import type { BoxValue } from '@/core/ui/boxInput'
import type { ResponsiveVisibility } from '@/core/ui/responsiveCss'
import type { CardTranslations } from '@/core/registry/portableCardTypes'
import type { VisibleIf } from '@/core/registry/cardConditions'
import type { CardAction, CardActionValue, CardGesture } from '@/core/ui/cardActions'

export type ViewLayout = 'sections' | 'flex' | 'panel' | 'sidebar' | 'grid'
export type CardOrientation = 'auto' | 'vertical' | 'horizontal'
export type ViewWidth = 'default' | 'full'
export type ViewAlign = 'left' | 'center' | 'right'
export type PopupSize = 'sm' | 'md' | 'lg' | 'full'
export type DialogContentPosition = 'top' | 'center' | 'bottom'
export type DialogMobileHeight = 'full' | 'fit-content'

export type ViewBackgroundAttachment = 'scroll' | 'fixed'
export type ViewBackgroundSize = 'auto' | 'cover' | 'contain'
export type ViewBackgroundAlignment =
  | 'top left'
  | 'top center'
  | 'top right'
  | 'center left'
  | 'center'
  | 'center right'
  | 'bottom left'
  | 'bottom center'
  | 'bottom right'
export type ViewBackgroundRepeat = 'repeat' | 'no-repeat'

export interface ViewBackgroundMedia {
  media_content_id: string
  media_content_type?: string
  metadata?: {
    title?: string
    thumbnail?: string
    media_class?: string
    children_media_class?: string | null
    navigateIds?: Array<{
      media_content_id?: string
      media_content_type?: string
    }>
  }
}

/** Same shape Home Assistant uses for Lovelace view backgrounds. */
export interface ViewBackgroundConfig {
  image?: string | ViewBackgroundMedia
  opacity?: number
  attachment?: ViewBackgroundAttachment
  size?: ViewBackgroundSize
  alignment?: ViewBackgroundAlignment
  repeat?: ViewBackgroundRepeat
}

export interface CardConfig {
  id: string
  type: string
  config: Record<string, unknown>
  css?: string
  /** Screen-size gate — undefined falls back to the card type's default. */
  visibility?: ResponsiveVisibility
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
  background?: string | ViewBackgroundConfig
  /** Global bars on this view — the right sidebar is off unless enabled */
  showSidebarLeft?: boolean
  showSidebarRight?: boolean
  showHeader?: boolean
  showBottom?: boolean
  padding?: BoxValue
  margin?: BoxValue
  width?: ViewWidth
  align?: ViewAlign
  /**
   * Columns for a bar whose `scope` is 'perView' — kept separate per view
   * instead of sharing the bar's global `columns`. Unused (and ignored) for
   * bars that stay global.
   */
  barColumns?: Partial<Record<BarPosition, BarColumn[]>>
  sections: SectionConfig[]
}

/**
 * A custom popup: a dialog that is defined once for the whole panel and holds
 * its own cards, laid out like a flex view.
 */
export interface PopupConfig {
  id: string
  title: string
  icon?: string
  /** Width preset — an explicit `width` wins over it */
  size?: PopupSize
  /** Explicit dialog width in px */
  width?: number
  /** Explicit dialog body height in px — the content decides when unset */
  height?: number
  /** Custom CSS for the popup body, scoped via [data-vp-card] */
  css?: string
  align?: ViewAlign
  padding?: BoxValue
  sections: SectionConfig[]
}

export type CustomCardVariableType =
  | 'action'
  | 'entity'
  | 'string'
  | 'number'
  | 'boolean'
  | 'icon'
  | 'color'
  | 'view'
  | 'popup'
  | 'select'
  | 'list'

export interface CustomCardVariable {
  id: string
  key: string
  label: string
  /** Settings box this variable is shown in — ungrouped variables share one box */
  group?: string
  /** Conditions on other variables that decide whether this one is offered */
  visibleIf?: VisibleIf
  type: CustomCardVariableType
  required: boolean
  domain?: string
  /** `action` variables default to one action per gesture instead of a scalar */
  default?: string | number | boolean | Partial<Record<CardGesture, CardActionValue>>
  options?: string[]
  optionLabels?: Record<string, string>
  min?: number
  max?: number
  step?: number
  /** `list` only: the scalar fields repeated for every entry */
  itemFields?: Array<Omit<CustomCardVariable, 'id'>>
  /** `list` only: entries can be indented to build a hierarchy */
  nestable?: boolean
  /** `action` only: gestures the card reacts to — all three by default */
  gestures?: CardGesture[]
  /** `action` only: actions those gestures may use — all of them by default */
  actions?: CardAction[]
}

/**
 * Detail view of a card: which dialog card the `more-info` action shows and
 * which of the card's variables are handed to it.
 */
export interface CardDetailConfig {
  /** Portable card type of area `dialog` — the domain default when unset */
  card?: string
  /** Variable keys passed on — all of them when unset */
  variables?: string[]
  /** Variable holding the entity the domain default is resolved from */
  entityKey?: string
  /** Vertical position of the detail card inside the dialog (default center) */
  position?: DialogContentPosition
  /** Mobile dialog height (default fit-content for detail cards) */
  mobileHeight?: DialogMobileHeight
}

export interface CustomCardDefinition {
  id: string
  /** Contents of the card's `<script data-vue-panel-translation>` block */
  translations: CardTranslations
  format: 'vue-panel-card'
  formatVersion: 2
  apiVersion: 1
  manufacturer: string
  cardName: string
  name: string
  description: string
  icon: string
  group: string
  areas: Array<'dashboard' | 'sidebar' | 'header' | 'bottom' | 'dialog'>
  /** Detail view opened by the `more-info` action — domain default when unset */
  detail?: CardDetailConfig
  capabilities: Array<
    | 'entity:read'
    | 'entity:subscribe'
    | 'icon:render'
    | 'service:call'
    | 'navigation:read'
    | 'navigation:write'
    | 'dashboard:context'
    | 'shell:events'
    | 'dialog:open'
    | 'host:navigate'
    | 'host:badges'
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

/**
 * 'global' shares one set of columns/cards across every view (the default).
 * 'perView' instead keeps a separate set per view, stored in that view's own
 * `barColumns` — editing the bar while a view is active then only changes
 * that view.
 */
export type BarScope = 'global' | 'perView'

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
  /** Whether `columns` is shared globally or each view keeps its own — defaults to 'global' */
  scope?: BarScope
  /**
   * Master switch for a 'global' bar — hides it dashboard-wide regardless of
   * any view's own show/hide toggle. Meaningless (and ignored) for 'perView'
   * bars, where each view already decides for itself. Defaults to true.
   */
  enabled?: boolean
  columns: BarColumn[]
}

export type BarConfig = Record<BarPosition, BarEntry>

export type DialogAnimation = 'none' | 'simple' | 'scale' | 'slide-up'

export interface DashboardSettings {
  theme: 'dark' | 'light' | 'auto'
  uiTheme: string
  screensaverMinutes: number
  autoReturnSeconds: number
  /**
   * Collapse Home Assistant's own sidebar while this panel is open — for
   * wall tablets that should show nothing but the dashboard. Ignored in
   * edit mode, where the sidebar stays reachable.
   */
  hideHaSidebar?: boolean
  /** Animate the switch from one view to the next — on unless turned off */
  viewTransition?: boolean
  /** Animation used by all engine dialogs and runtime popups */
  dialogAnimation: DialogAnimation
  /** Animation used instead on mobile devices */
  mobileDialogAnimation: DialogAnimation
  customCss?: string
}

export interface DashboardConfig {
  format: 'vue-panel-dashboard'
  formatVersion: 1
  revision: number
  settings?: Partial<DashboardSettings>
  bars?: Partial<BarConfig>
  /** Custom popups, available panel-wide from every tap action */
  popups?: PopupConfig[]
  views: ViewConfig[]
}
