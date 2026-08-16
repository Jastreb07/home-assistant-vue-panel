import { defineCard } from '@/core/registry/cardRegistry'
import { NATIVE_GROUP } from '@/core/registry/cardGroups'

export default defineCard({
  type: 'light',
  name: 'cards.light.name',
  icon: 'mdi:lightbulb',
  group: NATIVE_GROUP,
  component: () => import('./LightCard.vue'),
  schema: {
    entity: { type: 'entity', domain: 'light', label: 'cards.light.entity' },
    name: { type: 'string', label: 'cards.light.displayName', optional: true },
    showBrightness: { type: 'boolean', label: 'cards.light.showBrightness', default: true },
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
