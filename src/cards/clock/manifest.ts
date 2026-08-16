import { defineCard } from '@/core/registry/cardRegistry'

/**
 * In the bars the clock sits directly on the bar background — no tile,
 * no shadow. The same CSS is shared by every sidebar and header slot.
 */
const BARE = `.clock-card {
  background: none;
  box-shadow: none;
  border-radius: 0;
  padding: 0;
  min-height: 0;
}
.time {
  font-size: 44px;
}`

export default defineCard({
  type: 'clock',
  name: 'cards.clock.name',
  icon: 'mdi:clock-outline',
  component: () => import('./ClockCard.vue'),
  schema: {
    showDate: { type: 'boolean', label: 'cards.clock.showDate', default: true },
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
  css: {
    sidebar_top: BARE,
    sidebar_center: BARE,
    sidebar_bottom: BARE,
    header_left: BARE,
    header_center: BARE,
    header_right: BARE,
  },
})
