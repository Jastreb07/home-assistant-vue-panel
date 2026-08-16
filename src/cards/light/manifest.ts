import { defineCard } from '@/core/registry/cardRegistry'

export default defineCard({
  type: 'light',
  name: 'cards.light.name',
  icon: 'mdi:lightbulb',
  component: () => import('./LightCard.vue'),
  schema: {
    entity: { type: 'entity', domain: 'light', label: 'cards.light.entity' },
    name: { type: 'string', label: 'cards.light.displayName', optional: true },
    showBrightness: { type: 'boolean', label: 'cards.light.showBrightness', default: true },
  },
  defaultSize: { cols: 1, rows: 1 },
  areas: ['dashboard', 'nav'],
})
