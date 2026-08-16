import { defineCard } from '@/core/registry/cardRegistry'

export default defineCard({
  type: 'clock',
  name: 'cards.clock.name',
  icon: 'mdi:clock-outline',
  component: () => import('./ClockCard.vue'),
  schema: {
    showDate: { type: 'boolean', label: 'cards.clock.showDate', default: true },
  },
  defaultSize: { cols: 1, rows: 1 },
})
