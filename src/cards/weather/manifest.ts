import { defineCard } from '@/core/registry/cardRegistry'
import { NATIVE_GROUP } from '@/core/registry/cardGroups'

/**
 * In the sidebar the card sits directly on the bar background — no tile,
 * no shadow. Shared by every sidebar slot.
 */
const BARE = `.weather-card {
  background: none;
  box-shadow: none;
  border-radius: 0;
  padding: 0;
  min-height: 0;
}`

export default defineCard({
  type: 'weather',
  name: 'cards.weather.name',
  icon: 'mdi:weather-partly-cloudy',
  group: NATIVE_GROUP,
  component: () => import('./WeatherCard.vue'),
  schema: {
    entity: { type: 'entity', domain: 'weather', label: 'cards.weather.entity' },
    name: { type: 'string', label: 'cards.weather.displayName', optional: true },
    showDetails: { type: 'boolean', label: 'cards.weather.showDetails', default: true },
    roundTemperature: {
      type: 'boolean',
      label: 'cards.weather.roundTemperature',
      default: true,
    },
  },
  defaultSize: { cols: 2, rows: 1 },
  areas: ['dashboard', 'sidebar_top', 'sidebar_center', 'sidebar_bottom'],
  css: {
    sidebar_top: BARE,
    sidebar_center: BARE,
    sidebar_bottom: BARE,
  },
})
