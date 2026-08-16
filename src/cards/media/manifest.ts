import { defineCard } from '@/core/registry/cardRegistry'
import { NATIVE_GROUP } from '@/core/registry/cardGroups'

export default defineCard({
  type: 'media',
  name: 'cards.media.name',
  icon: 'mdi:speaker',
  group: NATIVE_GROUP,
  component: () => import('./MediaCard.vue'),
  schema: {
    entity: { type: 'entity', domain: 'media_player', label: 'cards.media.entity' },
    name: { type: 'string', label: 'cards.media.displayName', optional: true },
    showVolume: { type: 'boolean', label: 'cards.media.showVolume', default: true },
  },
  defaultSize: { cols: 2, rows: 1 },
})
