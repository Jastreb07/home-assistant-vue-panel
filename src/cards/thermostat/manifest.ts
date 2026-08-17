import { defineCard } from '@/core/registry/cardRegistry'
import { NATIVE_GROUP } from '@/core/registry/cardGroups'

export default defineCard({
  type: 'thermostat',
  name: 'cards.thermostat.name',
  icon: 'mdi:thermostat',
  group: NATIVE_GROUP,
  component: () => import('./ThermostatCard.vue'),
  schema: {
    entity: { type: 'entity', domain: 'climate', label: 'cards.thermostat.entity' },
    name: { type: 'string', label: 'cards.thermostat.displayName', optional: true },
    step: { type: 'number', label: 'cards.thermostat.step', default: 0.5 },
  },
  defaultSize: { cols: 1, rows: 1, width: 140, height: 120 },
})
