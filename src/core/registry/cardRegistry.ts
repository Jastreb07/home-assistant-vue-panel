import {
  defineAsyncComponent,
  defineComponent,
  h,
  shallowReactive,
  type Component,
  type PropType,
} from 'vue'
import { HASS_GROUP, NATIVE_GROUP, OTHER_GROUP, type CardGroup } from './cardGroups'
import { HASS_CARD_TYPE, hassCardAreas } from './hassCards'
import type { BarPosition } from '@/core/config/types'
import { getPortableCard, invalidatePortableCardCatalog, listPortableCards } from '@/core/ha/cardApi'
import PortableCardHost from '@/core/custom-cards/PortableCardHost.vue'
import type {
  CardTranslations,
  PortableCardCatalogEntry,
  PortableCardVariable,
} from './portableCardTypes'
import { cardText, emptyCardTranslations } from './cardTranslations'
import type { VisibleIf } from './cardConditions'
import type { CardAction, CardGesture } from '@/core/ui/cardActions'
import {
  defaultResponsiveVisibility,
  normalizeVisibility,
  type ResponsiveVisibility,
} from '@/core/ui/responsiveCss'

export { NATIVE_GROUP, OTHER_GROUP, type CardGroup }

/** Where a card may be placed — the dashboard grid, a global bar or a popup. */
export type CardArea = 'dashboard' | 'sidebar' | 'header' | 'bottom' | 'dialog'

/** Both sidebars accept the same cards, so they share one card area. */
export function barCardArea(position: BarPosition): Exclude<CardArea, 'dashboard' | 'dialog'> {
  return position === 'sidebar-left' || position === 'sidebar-right' ? 'sidebar' : position
}
export type CardCssArea = 'default' | 'bar_sidebar' | 'bar_header' | 'bar_bottom'

export interface CardSchemaField {
  type:
    | 'entity'
    | 'string'
    | 'number'
    | 'boolean'
    | 'select'
    | 'view'
    | 'popup'
    | 'icon'
    | 'color'
    | 'list'
    | 'action'
  label: string
  literalLabel?: boolean
  /** Collapsible box this field is shown in — entity fields are never grouped */
  group?: string
  /** Only offered while these conditions on other fields hold */
  visibleIf?: VisibleIf
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
  /** `action` only: the gestures this card reacts to — all three by default */
  gestures?: CardGesture[]
  /** `action` only: the actions those gestures may use — all of them by default */
  actions?: CardAction[]
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
  /** Catalogs behind every `translation.*` string of this card */
  translations: CardTranslations
  /** Absent for engine-native cards such as the Home Assistant card host */
  portable?: PortableCardCatalogEntry
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
    visibleIf: variable.visibleIf,
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
    gestures: variable.gestures,
    actions: variable.actions,
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
    props: {
      config: { type: Object, required: true },
      /** Where this instance sits — every renderer passes its own area */
      area: { type: String as PropType<CardArea>, default: 'dashboard' },
    },
    emits: ['action'],
    setup(props, { emit }) {
      return () => h(PortableCardHost, {
        cardType: type,
        config: props.config as Record<string, unknown>,
        area: props.area,
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
    translations: entry.translations ?? emptyCardTranslations,
    portable: entry,
  }
}

/**
 * Host manifest for native Home Assistant cards. One engine card type covers
 * every Lovelace card — the HA config travels inside `config.hass`, so the
 * dashboard file keeps the `manufacturer/card-name` shape.
 */
function hassCardManifest(): CardManifest {
  return {
    type: HASS_CARD_TYPE,
    name: 'editor.hassCards.cardName',
    icon: 'mdi:home-assistant',
    group: HASS_GROUP,
    component: defineAsyncComponent(() => import('@/core/ha/HassCardHost.vue')),
    areas: [...hassCardAreas],
    translations: emptyCardTranslations,
  }
}

export async function syncPortableCardCatalog(): Promise<void> {
  const catalog = await listPortableCards()
  for (const type of Object.keys(cardRegistry)) delete cardRegistry[type]
  for (const entry of catalog) cardRegistry[entry.type] = portableManifest(entry)
  cardRegistry[HASS_CARD_TYPE] = hassCardManifest()
  invalidatePortableCardCatalog()
}

/** A card type's default screen-size gate — the fallback when an instance has no override. */
export function cardDefaultVisibility(type: string): ResponsiveVisibility {
  return normalizeVisibility({
    ...defaultResponsiveVisibility,
    ...cardRegistry[type]?.defaultResponsive,
  })
}

export async function cardDefaultCss(
  type: string,
  _area: CardCssArea = 'default',
): Promise<string> {
  // Engine-native cards (the Home Assistant host) ship no editable CSS
  const manifest = cardRegistry[type]
  if (!manifest?.portable) return ''
  const document = await getPortableCard(type)
  return document.css
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

/**
 * A card's own name: `translation.*` names come from its catalogs, engine
 * cards keep using the panel's message keys.
 */
export function cardDisplayName(
  manifest: CardManifest,
  translate: (key: string) => string,
  locale = 'en',
): string {
  return manifest.literalName
    ? cardText(manifest.translations, manifest.name, locale)
    : translate(manifest.name)
}

/** Description of a card as shown in the picker and the card editor. */
export function cardDescription(manifest: CardManifest, locale = 'en'): string {
  return manifest.portable
    ? cardText(manifest.translations, manifest.portable.description, locale)
    : ''
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
    entry.cards.sort(
      (a, b) => byName(cardDisplayName(a, translate, locale), cardDisplayName(b, translate, locale)),
    )
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
