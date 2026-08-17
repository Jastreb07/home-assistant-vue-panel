import { defineCard } from '@/core/registry/cardRegistry'

export default defineCard({
  type: 'bottom-bar',
  name: 'cards.bottomBar.name',
  icon: 'mdi:dock-bottom',
  component: () => import('./BottomBarCard.vue'),
  barPositions: ['bottom'],
  schema: {
    placement: {
      type: 'select',
      label: 'editor.barPlacement.label',
      options: ['full', 'view'],
      optionLabels: {
        full: 'editor.barPlacement.full',
        view: 'editor.barPlacement.view',
      },
      default: 'view',
    },
    height: { type: 'number', label: 'editor.bottom.height', default: 64, min: 40, max: 240, step: 4 },
    horizontalAlign: {
      type: 'select',
      label: 'editor.nav.horizontal',
      options: ['start', 'center', 'end', 'stretch'],
      optionLabels: {
        start: 'editor.nav.alignLeft',
        center: 'editor.nav.alignCenter',
        end: 'editor.nav.alignRight',
        stretch: 'editor.nav.alignSpread',
      },
      default: 'center',
    },
    verticalAlign: {
      type: 'select',
      label: 'editor.nav.vertical',
      options: ['start', 'center', 'end', 'stretch'],
      optionLabels: {
        start: 'editor.nav.alignTop',
        center: 'editor.nav.alignMiddle',
        end: 'editor.nav.alignBottom',
        stretch: 'editor.nav.alignFull',
      },
      default: 'center',
    },
  },
})
