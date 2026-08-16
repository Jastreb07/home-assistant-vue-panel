import { defineCard } from '@/core/registry/cardRegistry'

export default defineCard({
  type: 'sensor',
  name: 'cards.sensor.name',
  icon: 'mdi:gauge',
  component: () => import('./SensorCard.vue'),
  schema: {
    entity: { type: 'entity', label: 'cards.sensor.entity' },
    name: { type: 'string', label: 'cards.sensor.displayName', optional: true },
    icon: { type: 'icon', label: 'cards.sensor.icon', optional: true },
  },
  defaultSize: { cols: 1, rows: 1 },
  areas: [
    'dashboard',
    'sidebar_top',
    'sidebar_center',
    'sidebar_bottom',
    'header_left',
    'header_center',
    'header_right',
  ],
})
