import type { CardArea } from './cardRegistry'

/**
 * Home Assistant's own Lovelace cards, hosted inside Vue Panel.
 *
 * All of them share ONE engine card type: the HA card configuration is stored
 * under `config.hass`, so the dashboard file keeps the `manufacturer/card-name`
 * shape the backend validates while still carrying arbitrary HA card configs.
 */
export const HASS_CARD_TYPE = 'hass/lovelace'

/**
 * Areas that may hold a Home Assistant card. The bars are still left out:
 * they lay their cards out along a scrolling track of their own, which the
 * overlay bridge does not clip against yet. Extend this list once they do.
 */
export const hassCardAreas: CardArea[] = ['dashboard', 'dialog']

export interface HassCardType {
  /** Lovelace card type, e.g. `light` or `custom:mushroom-light-card` */
  type: string
  name: string
  icon: string
}

/**
 * The cards shipped with Home Assistant. HA has no API to enumerate them, so
 * this list is maintained here; anything missing (and every HACS card) can
 * still be added through the custom-card list or by typing the type by hand.
 */
export const hassCoreCards: HassCardType[] = [
  { type: 'alarm-panel', name: 'Alarm panel', icon: 'mdi:shield-home' },
  { type: 'area', name: 'Area', icon: 'mdi:sofa' },
  { type: 'button', name: 'Button', icon: 'mdi:gesture-tap-button' },
  { type: 'calendar', name: 'Calendar', icon: 'mdi:calendar' },
  { type: 'clock', name: 'Clock', icon: 'mdi:clock-outline' },
  { type: 'conditional', name: 'Conditional', icon: 'mdi:card-multiple-outline' },
  { type: 'energy-date-selection', name: 'Energy date selection', icon: 'mdi:calendar-range' },
  { type: 'entities', name: 'Entities', icon: 'mdi:format-list-bulleted' },
  { type: 'entity', name: 'Entity', icon: 'mdi:card-text-outline' },
  { type: 'entity-filter', name: 'Entity filter', icon: 'mdi:filter-variant' },
  { type: 'gauge', name: 'Gauge', icon: 'mdi:gauge' },
  { type: 'glance', name: 'Glance', icon: 'mdi:view-grid-outline' },
  { type: 'grid', name: 'Grid', icon: 'mdi:view-grid' },
  { type: 'heading', name: 'Heading', icon: 'mdi:format-header-1' },
  { type: 'history-graph', name: 'History graph', icon: 'mdi:chart-line' },
  { type: 'horizontal-stack', name: 'Horizontal stack', icon: 'mdi:view-column' },
  { type: 'humidifier', name: 'Humidifier', icon: 'mdi:air-humidifier' },
  { type: 'iframe', name: 'Webpage', icon: 'mdi:web' },
  { type: 'light', name: 'Light', icon: 'mdi:lightbulb' },
  { type: 'logbook', name: 'Logbook', icon: 'mdi:format-list-text' },
  { type: 'map', name: 'Map', icon: 'mdi:map' },
  { type: 'markdown', name: 'Markdown', icon: 'mdi:language-markdown' },
  { type: 'media-control', name: 'Media control', icon: 'mdi:play-box-outline' },
  { type: 'picture', name: 'Picture', icon: 'mdi:image' },
  { type: 'picture-elements', name: 'Picture elements', icon: 'mdi:image-edit' },
  { type: 'picture-entity', name: 'Picture entity', icon: 'mdi:image-frame' },
  { type: 'picture-glance', name: 'Picture glance', icon: 'mdi:image-multiple' },
  { type: 'plant-status', name: 'Plant status', icon: 'mdi:flower' },
  { type: 'sensor', name: 'Sensor', icon: 'mdi:chart-bell-curve' },
  { type: 'statistic', name: 'Statistic', icon: 'mdi:chart-box-outline' },
  { type: 'statistics-graph', name: 'Statistics graph', icon: 'mdi:chart-bar' },
  { type: 'thermostat', name: 'Thermostat', icon: 'mdi:thermostat' },
  { type: 'tile', name: 'Tile', icon: 'mdi:card-outline' },
  { type: 'todo-list', name: 'To-do list', icon: 'mdi:clipboard-list-outline' },
  { type: 'vertical-stack', name: 'Vertical stack', icon: 'mdi:view-sequential' },
  { type: 'weather-forecast', name: 'Weather forecast', icon: 'mdi:weather-partly-cloudy' },
]

/** True for the Vue Panel card type that hosts a Home Assistant card. */
export function isHassCardType(type: string | undefined): boolean {
  return type === HASS_CARD_TYPE
}

/** The HA card config stored inside a Vue Panel card's `config`. */
export function hassCardConfig(config: Record<string, unknown>): Record<string, unknown> {
  const nested = config?.hass
  return nested && typeof nested === 'object' && !Array.isArray(nested)
    ? nested as Record<string, unknown>
    : {}
}

/** A fresh Vue Panel card config wrapping the given Lovelace card type. */
export function newHassCardConfig(type: string): Record<string, unknown> {
  return { hass: { type } }
}
