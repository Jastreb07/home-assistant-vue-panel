import { defineCard } from '@/core/registry/cardRegistry'

export default defineCard({
  type: 'sidebar-bar',
  name: 'cards.sidebarBar.name',
  icon: 'mdi:dock-left',
  component: () => import('./SidebarBarCard.vue'),
  barPositions: ['sidebar'],
  defaultResponsive: { mobile: false },
  schema: {
    width: { type: 'number', label: 'editor.nav.width', default: 280, min: 160, max: 560, step: 10 },
    verticalAlign: {
      type: 'select',
      label: 'editor.nav.vertical',
      options: ['start', 'center', 'end', 'stretch'],
      optionLabels: {
        start: 'editor.nav.alignTop',
        center: 'editor.nav.alignMiddle',
        end: 'editor.nav.alignBottom',
        stretch: 'editor.nav.alignSpread',
      },
      default: 'start',
    },
    horizontalAlign: {
      type: 'select',
      label: 'editor.nav.horizontal',
      options: ['start', 'center', 'end', 'stretch'],
      optionLabels: {
        start: 'editor.nav.alignLeft',
        center: 'editor.nav.alignCenter',
        end: 'editor.nav.alignRight',
        stretch: 'editor.nav.alignFull',
      },
      default: 'stretch',
    },
  },
})
