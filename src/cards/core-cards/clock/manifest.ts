import { defineCard } from '@/core/registry/cardRegistry'
import { NATIVE_GROUP } from '@/core/registry/cardGroups'

/**
 * In the bars the clock sits directly on the bar background — no tile,
 * no shadow. Shared by every sidebar slot.
 */
const BARE = `.clock-card {
  background: none;
  box-shadow: none;
  border-radius: 0;
  padding: 0;
  min-height: 0;
  text-align: center;
}
.clock-card > .mdi {
  display: none;
}
.clock-card .info {
  margin-top: 0;
}
.time {
  font-size: 72px;
}
.date {
  font-size: 18px;
}`

export default defineCard({
  type: 'clock',
  name: 'cards.clock.name',
  icon: 'mdi:clock-outline',
  group: NATIVE_GROUP,
  component: () => import('./ClockCard.vue'),
  schema: {
    showTime: { type: 'boolean', label: 'cards.clock.showTime', default: true },
    showDate: { type: 'boolean', label: 'cards.clock.showDate', default: true },
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
  css: {
    sidebar_top: BARE,
    sidebar_center: BARE,
    sidebar_bottom: BARE,
    header_left: BARE,
    header_center: BARE,
    header_right: BARE,
    bottom_left: BARE,
    bottom_center: BARE,
    bottom_right: BARE,
  },
})
