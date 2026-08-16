import { defineCard } from '@/core/registry/cardRegistry'

export default defineCard({
  type: 'weather',
  name: 'cards.weather.name',
  icon: 'mdi:weather-partly-cloudy',
  component: () => import('./WeatherCard.vue'),
  schema: {
    entity: { type: 'entity', domain: 'weather', label: 'cards.weather.entity' },
    name: { type: 'string', label: 'cards.weather.displayName', optional: true },
    showDetails: { type: 'boolean', label: 'cards.weather.showDetails', default: true },
  },
  defaultSize: { cols: 2, rows: 1 },
})
