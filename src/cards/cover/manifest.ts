import { defineCard } from '@/core/registry/cardRegistry'
import { NATIVE_GROUP } from '@/core/registry/cardGroups'

export default defineCard({
  type: 'cover',
  name: 'cards.cover.name',
  icon: 'mdi:window-shutter',
  group: NATIVE_GROUP,
  component: () => import('./CoverCard.vue'),
  schema: {
    entity: { type: 'entity', domain: 'cover', label: 'cards.cover.entity' },
    name: { type: 'string', label: 'cards.cover.displayName', optional: true },
  },
  defaultSize: { cols: 1, rows: 1, width: 140, height: 120 },
  areas: [
    'dashboard',
    'sidebar_top',
    'sidebar_center',
    'sidebar_bottom',
    'header_left',
    'header_center',
    'header_right',
    'bottom_left',
    'bottom_center',
    'bottom_right',
  ],
})
