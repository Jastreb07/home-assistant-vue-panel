import { defineCard } from '@/core/registry/cardRegistry'

export default defineCard({
  type: 'room-tile',
  name: 'cards.roomTile.name',
  icon: 'mdi:door-open',
  component: () => import('./RoomTileCard.vue'),
  schema: {
    name: { type: 'string', label: 'cards.roomTile.roomName' },
    icon: { type: 'icon', label: 'cards.roomTile.icon', optional: true },
    targetView: { type: 'view', label: 'cards.roomTile.targetView', optional: true },
    temperatureEntity: {
      type: 'entity',
      domain: 'sensor',
      label: 'cards.roomTile.temperatureEntity',
      optional: true,
    },
    lightGroup: {
      type: 'entity',
      domain: 'light',
      label: 'cards.roomTile.lightGroup',
      optional: true,
    },
  },
  defaultSize: { cols: 1, rows: 1 },
  areas: ['dashboard', 'nav'],
})
