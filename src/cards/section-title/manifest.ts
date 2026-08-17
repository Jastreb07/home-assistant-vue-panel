import { defineCard } from '@/core/registry/cardRegistry'
import { NATIVE_GROUP } from '@/core/registry/cardGroups'

/** Heading of a section — a normal card, so it can be moved and styled like any other. */
export default defineCard({
  type: 'section-title',
  name: 'cards.sectionTitle.name',
  icon: 'mdi:format-title',
  group: NATIVE_GROUP,
  component: () => import('./SectionTitleCard.vue'),
  schema: {
    title: { type: 'string', label: 'cards.sectionTitle.title' },
    icon: { type: 'icon', label: 'cards.sectionTitle.icon', optional: true },
    align: {
      type: 'select',
      label: 'cards.sectionTitle.align',
      options: ['left', 'center', 'right'],
      default: 'left',
    },
    rule: { type: 'boolean', label: 'cards.sectionTitle.rule', default: true },
  },
  // A heading always takes a row of its own
  fullRow: true,
})
