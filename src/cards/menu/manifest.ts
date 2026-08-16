import { defineCard } from '@/core/registry/cardRegistry'

export default defineCard({
  type: 'menu',
  name: 'cards.menu.name',
  icon: 'mdi:format-list-bulleted',
  component: () => import('./MenuCard.vue'),
  // The item tree needs more than a schema field can express
  editor: () => import('./MenuEditor.vue'),
  schema: {
    orientation: {
      type: 'select',
      label: 'cards.menu.orientation',
      options: ['vertical', 'horizontal'],
      default: 'vertical',
    },
    showTitles: { type: 'boolean', label: 'cards.menu.showTitles', default: true },
    showIcons: { type: 'boolean', label: 'cards.menu.showIcons', default: true },
  },
  defaultSize: { cols: 1, rows: 1 },
  areas: [
    'sidebar_top',
    'sidebar_center',
    'sidebar_bottom',
    'header_left',
    'header_center',
    'header_right',
  ],
})
