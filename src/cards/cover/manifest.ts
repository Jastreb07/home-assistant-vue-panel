import { defineCard } from '@/core/registry/cardRegistry'

export default defineCard({
  type: 'cover',
  name: 'cards.cover.name',
  icon: 'mdi:window-shutter',
  component: () => import('./CoverCard.vue'),
  schema: {
    entity: { type: 'entity', domain: 'cover', label: 'cards.cover.entity' },
    name: { type: 'string', label: 'cards.cover.displayName', optional: true },
  },
  defaultSize: { cols: 1, rows: 1 },
  areas: ['dashboard', 'nav'],
})
