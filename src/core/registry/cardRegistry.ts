import {
  defineComponent,
  h,
  shallowReactive,
  type Component,
} from 'vue'
import { NATIVE_GROUP, OTHER_GROUP, type CardGroup } from './cardGroups'
import type { BarPosition } from '@/core/config/types'
import { getPortableCard, invalidatePortableCardCatalog, listPortableCards } from '@/core/ha/cardApi'
import PortableCardHost from '@/core/custom-cards/PortableCardHost.vue'
import type { PortableCardCatalogEntry, PortableCardVariable } from './portableCardTypes'
import {
  defaultResponsiveVisibility,
  withResponsiveCss,
  type ResponsiveVisibility,
} from '@/core/ui/responsiveCss'

export { NATIVE_GROUP, OTHER_GROUP, type CardGroup }

/** Where a card may be placed — the dashboard grid or a kind of global bar. */
export type CardArea = 'dashboard' | 'sidebar' | 'header' | 'bottom'

/** Both sidebars accept the same cards, so they share one card area. */
export function barCardArea(position: BarPosition): Exclude<CardArea, 'dashboard'> {
  return position === 'sidebar-left' || position === 'sidebar-right' ? 'sidebar' : position
}
export type CardCssArea = 'default' | 'bar_sidebar' | 'bar_header' | 'bar_bottom'

export interface CardSchemaField {
  type: 'entity' | 'string' | 'number' | 'boolean' | 'select' | 'view' | 'icon' | 'list'
  label: string
  literalLabel?: boolean
  /** Collapsible box this field is shown in — entity fields are never grouped */
  group?: string
  domain?: string
  options?: string[]
  optionLabels?: Record<string, string>
  literalOptionLabels?: boolean
  min?: number
  max?: number
  step?: number
  optional?: boolean
  required?: boolean
  default?: unknown
  /** `list` only: the fields repeated for every entry, in display order */
  itemFields?: CardSchemaListItemField[]
  /** `list` only: entries can be indented to build a hierarchy */
  nestable?: boolean
}

/** One field of a list entry — same as a schema field plus its storage key. */
export interface CardSchemaListItemField extends CardSchemaField {
  key: string
}

export interface CardManifest {
  type: string
  name: string
  literalName?: boolean
  icon: string
  group?: CardGroup
  /** Sandbox host component for this card type, created once per catalog entry. */
  component: Component
  schema?: Record<string, CardSchemaField>
  defaultSize?: { cols: number; rows: number; width?: number; height?: number }
  fullRow?: boolean
  areas?: CardArea[]
  defaultResponsive?: Partial<ResponsiveVisibility>
  portable: PortableCardCatalogEntry
}

export const cardRegistry = shallowReactive<Record<string, CardManifest>>({})

function portableSchema(variables: PortableCardVariable[]): Record<string, CardSchemaField> {
  return Object.fromEntries(variables.map((variable) => [
    variable.key,
    portableField(variable),
  ]))
}

function portableField(variable: PortableCardVariable): CardSchemaField {
  return {
    type: variable.type,
    label: variable.label,
    literalLabel: true,
    group: variable.group,
    domain: variable.domain,
    options: variable.options,
    optionLabels: variable.optionLabels,
    literalOptionLabels: true,
    min: variable.min,
    max: variable.max,
    step: variable.step,
    optional: !variable.required,
    required: variable.required,
    default: variable.default,
    itemFields: variable.itemFields?.map((item) => ({
      ...portableField(item),
      key: item.key,
    })),
    nestable: variable.nestable,
  }
}

function portableComponent(type: string): Component {
  return defineComponent({
    name: `PortableCard-${type.replace(/[^a-z0-9]/g, '-')}`,
    props: { config: { type: Object, required: true } },
    emits: ['action'],
    setup(props, { emit }) {
      return () => h(PortableCardHost, {
        cardType: type,
        config: props.config as Record<string, unknown>,
        onAction: (action: string, detail: Record<string, unknown>) => emit('action', action, detail),
      })
    },
  })
}

function portableManifest(entry: PortableCardCatalogEntry): CardManifest {
  return {
    type: entry.type,
    name: entry.name,
    literalName: true,
    icon: entry.icon,
    group: entry.manufacturer === 'vue-panel'
      ? NATIVE_GROUP
      : { id: `portable-${entry.group}`, label: entry.group, literalLabel: true },
    component: portableComponent(entry.type),
    schema: portableSchema(entry.variables),
    defaultSize: entry.defaultSize,
    fullRow: entry.fullRow,
    areas: entry.areas as CardArea[],
    defaultResponsive: entry.defaultResponsive,
    portable: entry,
  }
}

export async function syncPortableCardCatalog(): Promise<void> {
  const catalog = await listPortableCards()
  for (const type of Object.keys(cardRegistry)) delete cardRegistry[type]
  for (const entry of catalog) cardRegistry[entry.type] = portableManifest(entry)
  invalidatePortableCardCatalog()
}

function applyResponsiveDefaults(manifest: CardManifest | undefined, css: string): string {
  if (!manifest?.defaultResponsive) return css
  return withResponsiveCss(css, {
    ...defaultResponsiveVisibility,
    ...manifest.defaultResponsive,
  })
}

export function cardAreaCss(type: string, _area: CardCssArea = 'default'): string {
  return applyResponsiveDefaults(cardRegistry[type], '')
}

export async function cardDefaultCss(
  type: string,
  _area: CardCssArea = 'default',
): Promise<string> {
  const manifest = cardRegistry[type]
  if (!manifest) return ''
  const document = await getPortableCard(type)
  return applyResponsiveDefaults(manifest, document.css)
}

export function cardsForArea(area: CardArea): CardManifest[] {
  return Object.values(cardRegistry).filter((manifest) => manifest.areas?.includes(area))
}

export function cardsForBar(position: BarPosition): CardManifest[] {
  return cardsForArea(barCardArea(position))
}

export interface CardGroupEntry extends CardGroup {
  cards: CardManifest[]
}

export function cardDisplayName(
  manifest: CardManifest,
  translate: (key: string) => string,
): string {
  return manifest.literalName ? manifest.name : translate(manifest.name)
}

export function groupedCardsForArea(
  area: CardArea,
  translate: (key: string) => string,
  locale?: string,
): CardGroupEntry[] {
  const groups = new Map<string, CardGroupEntry>()
  for (const manifest of cardsForArea(area)) {
    const group = manifest.group ?? OTHER_GROUP
    let entry = groups.get(group.id)
    if (!entry) {
      entry = { ...group, cards: [] }
      groups.set(group.id, entry)
    }
    entry.cards.push(manifest)
  }
  const byName = (a: string, b: string) => a.localeCompare(b, locale)
  for (const entry of groups.values()) {
    entry.cards.sort((a, b) => byName(cardDisplayName(a, translate), cardDisplayName(b, translate)))
  }
  return [...groups.values()].sort((a, b) => {
    if (a.id === NATIVE_GROUP.id) return b.id === NATIVE_GROUP.id ? 0 : -1
    if (b.id === NATIVE_GROUP.id) return 1
    const aLabel = a.literalLabel ? a.label : translate(a.label)
    const bLabel = b.literalLabel ? b.label : translate(b.label)
    return byName(aLabel, bLabel)
  })
}

export function resolveCardComponent(type: string): Component | null {
  return cardRegistry[type]?.component ?? null
}
