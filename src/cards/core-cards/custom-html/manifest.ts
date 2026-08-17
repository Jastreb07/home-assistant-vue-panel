import { defineCard } from '@/core/registry/cardRegistry'
import { CUSTOM_GROUP } from '@/core/registry/cardGroups'

export default defineCard({
  type: 'custom-html',
  name: 'cards.customHtml.name',
  icon: 'mdi:code-tags',
  group: CUSTOM_GROUP,
  component: () => import('./CustomHtmlCard.vue'),
  defaultSize: { cols: 1, rows: 1, width: 140, height: 120 },
  // Definitions are added to the picker dynamically; the generic renderer stays hidden.
  areas: [],
})
