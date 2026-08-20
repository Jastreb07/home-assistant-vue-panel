<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type {
  CustomCardDefinition,
  CustomCardVariable,
  CustomCardVariableType,
} from '@/core/config/types'
import { newId, useDashboardStore } from '@/core/config/dashboardStore'
import {
  createPortableCard,
  deletePortableCard,
  getPortableCard,
  importPortableCard,
  isCardRevisionConflict,
  updatePortableCard,
} from '@/core/ha'
import { cardRegistry, syncPortableCardCatalog } from '@/core/registry/cardRegistry'
import type { CardLanguage, CardTranslations } from '@/core/registry/portableCardTypes'
import {
  DEFAULT_TRANSLATION_FALLBACK,
  TRANSLATION_PREFIX,
  cardLanguageName,
  cardTranslation,
  isCardLanguage,
  isTranslationKey,
} from '@/core/registry/cardTranslations'
import BaseButton from '@/core/ui/BaseButton.vue'
import BaseCheckbox from '@/core/ui/BaseCheckbox.vue'
import BaseCodeEditor from '@/core/ui/BaseCodeEditor.vue'
import BaseDialog from '@/core/ui/BaseDialog.vue'
import BaseInput from '@/core/ui/BaseInput.vue'
import BaseSelectMenu from '@/core/ui/BaseSelectMenu.vue'
import BaseTabs from '@/core/ui/BaseTabs.vue'
import BaseVariableCard from '@/core/ui/BaseVariableCard.vue'
import MdiIcon from '@/core/ui/MdiIcon.vue'
import { mdiIconOptions } from '@/core/ui/mdiIconNames'
import type { SelectOption } from '@/core/ui/selectMenu'
import type { TabItem } from '@/core/ui/tabs'
import { alertDialog, choiceDialog, confirmDialog } from '@/core/ui/dialogService'
import EntityPicker from '@/core/editor/EntityPicker.vue'
import CardRuntime from './CardRuntime.vue'
import { editorDefinitionFromDocument } from './cardEditorModel'

const props = defineProps<{ definition?: CustomCardDefinition }>()
const emit = defineEmits<{ close: []; saved: [definition: CustomCardDefinition] }>()
const { t, locale } = useI18n()
const store = useDashboardStore()

const DEFAULT_HTML = `<article class="my-card">
  <div class="my-card__icon">&lt;/&gt;</div>
  <div class="my-card__text">
    <strong>My custom card</strong>
    <span>HTML, CSS und JavaScript</span>
  </div>
</article>`

const DEFAULT_CSS = `.my-card {
  width: 100%;
  height: 100%;
  padding: 14px 16px;
  border-radius: var(--card-radius);
  background: var(--card-bg);
  box-shadow: var(--card-shadow);
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
}

.my-card__icon {
  font-size: 28px;
  color: var(--accent);
}

.my-card__text {
  margin-top: auto;
  display: grid;
  gap: 3px;
}

.my-card__text span {
  color: var(--text-secondary);
  font-size: 11px;
}`

const DEFAULT_JAVASCRIPT = `// The runtime exposes a controlled Home Assistant API as "vuePanel".
// Read instance variables with vuePanel.config, for example:
// const entityId = vuePanel.config.entity;
// const entity = await vuePanel.getEntity('sensor.example');
// await vuePanel.callService('light', 'toggle', {}, { entity_id: 'light.example' });`

interface FullCodeMetadata {
  format: 'vue-panel-card'
  formatVersion: 2
  apiVersion: 1
  manufacturer: string
  cardName: string
  name: string
  description: string
  icon: string
  group: string
  areas: CustomCardDefinition['areas']
  capabilities: CustomCardDefinition['capabilities']
  defaultSize: CustomCardDefinition['defaultSize']
  defaultResponsive: CustomCardDefinition['defaultResponsive']
  fullRow: boolean
  variables: Array<Omit<CustomCardVariable, 'id'>>
}

function freshDefinition(): CustomCardDefinition {
  const cardName = `custom-card-${Date.now().toString(36)}`
  return {
    id: `local/${cardName}`,
    format: 'vue-panel-card',
    formatVersion: 2,
    apiVersion: 1,
    manufacturer: 'local',
    cardName,
    name: '',
    description: '',
    icon: 'mdi:code-tags',
    group: 'local',
    translations: { fallback: 'en', languages: { en: {}, de: {} } },
    areas: ['dashboard'],
    capabilities: ['entity:read', 'entity:subscribe', 'icon:render', 'service:call'],
    html: DEFAULT_HTML,
    css: DEFAULT_CSS,
    javascript: DEFAULT_JAVASCRIPT,
    variables: [],
    defaultSize: { cols: 1, rows: 1, width: 140, height: 120 },
    defaultResponsive: {
      mobile: true,
      tablet: true,
      desktop: true,
      mobileMax: 767,
      tabletMax: 1023,
    },
    fullRow: false,
    writable: true,
    source: 'local',
  }
}

function initialDefinition(): CustomCardDefinition {
  const definition = JSON.parse(
    JSON.stringify(props.definition ?? freshDefinition()),
  ) as CustomCardDefinition
  definition.variables ??= []
  definition.translations ??= { fallback: 'en', languages: {} }
  definition.translations.languages ??= {}
  // English stays editable because it is the last fallback of every card
  definition.translations.languages[DEFAULT_TRANSLATION_FALLBACK] ??= {}
  return definition
}

const draft = ref<CustomCardDefinition>(initialDefinition())
const tab = ref('settings')
const validationAttempted = ref(false)
const variableEditorMode = ref('visual')
const variableJsonText = ref('')
const variableJsonError = ref('')
const fullCodeText = ref('')
const fullCodeError = ref('')
const fullCodeFullscreen = ref(false)
const importInput = ref<HTMLInputElement | null>(null)
const editorLayout = ref<HTMLElement | null>(null)
const editorShare = ref(57)
const splitterDragging = ref(false)
const importMode = ref(false)
const duplicating = ref(false)

const editorLayoutStyle = computed(() => ({
  '--custom-editor-share': `${editorShare.value}%`,
}))

const tabs = computed<TabItem[]>(() => [
  { value: 'settings', label: t('editor.tabSettings'), icon: 'mdi:tune' },
  { value: 'variables', label: t('customCards.variables.tab'), icon: 'mdi:variable' },
  { value: 'translations', label: t('customCards.translations.tab'), icon: 'mdi:translate' },
  { value: 'html', label: 'HTML', icon: 'mdi:language-html5' },
  { value: 'css', label: 'CSS', icon: 'mdi:language-css3' },
  { value: 'javascript', label: 'JS', icon: 'mdi:language-javascript' },
  { value: 'fullCode', label: t('customCards.fullCode.tab'), icon: 'mdi:file-code-outline', align: 'end' },
])

const variableEditorTabs = computed(() => [
  { value: 'visual', label: t('customCards.variables.visual'), icon: 'mdi:view-dashboard-edit-outline' },
  { value: 'json', label: 'JSON', icon: 'mdi:code-json' },
])

const variableTypeOptions = computed<SelectOption[]>(() => [
  { value: 'entity', label: t('customCards.variables.types.entity') },
  { value: 'string', label: t('customCards.variables.types.string') },
  { value: 'number', label: t('customCards.variables.types.number') },
  { value: 'boolean', label: t('customCards.variables.types.boolean') },
  { value: 'icon', label: t('customCards.variables.types.icon') },
  { value: 'view', label: t('customCards.variables.types.view') },
  { value: 'select', label: t('customCards.variables.types.select') },
  { value: 'list', label: t('customCards.variables.types.list') },
])

const areaOptions = computed(() => [
  { value: 'dashboard' as const, label: t('customCards.areas.dashboard') },
  { value: 'sidebar' as const, label: t('customCards.areas.sidebar') },
  { value: 'header' as const, label: t('customCards.areas.header') },
  { value: 'bottom' as const, label: t('customCards.areas.bottom') },
])

const capabilityOptions = computed(() => [
  'entity:read',
  'entity:subscribe',
  'icon:render',
  'service:call',
  'navigation:read',
  'navigation:write',
  'dashboard:context',
  'shell:events',
] as const)

function toggleArrayValue<T>(values: T[], value: T, enabled: boolean): T[] {
  return enabled
    ? [...new Set([...values, value])]
    : values.filter((candidate) => candidate !== value)
}

function setEditorShare(value: number) {
  const width = editorLayout.value?.getBoundingClientRect().width ?? 1000
  const minimum = Math.min(45, 260 / width * 100)
  const maximum = Math.max(minimum, (width - 294) / width * 100)
  editorShare.value = Math.round(Math.min(maximum, Math.max(minimum, value)) * 10) / 10
}

function updateEditorShare(clientX: number) {
  const bounds = editorLayout.value?.getBoundingClientRect()
  if (!bounds) return
  setEditorShare((clientX - bounds.left) / bounds.width * 100)
}

function startSplitter(event: PointerEvent) {
  splitterDragging.value = true
  const target = event.currentTarget as HTMLElement
  target.setPointerCapture(event.pointerId)
  updateEditorShare(event.clientX)
}

function moveSplitter(event: PointerEvent) {
  if (splitterDragging.value) updateEditorShare(event.clientX)
}

function stopSplitter(event: PointerEvent) {
  splitterDragging.value = false
  const target = event.currentTarget as HTMLElement
  if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId)
}

function resizeWithKeyboard(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  if (event.key === 'Home') setEditorShare(30)
  else if (event.key === 'End') setEditorShare(70)
  else setEditorShare(editorShare.value + (event.key === 'ArrowRight' ? 2 : -2))
}

const iconOptions = computed<SelectOption[]>(() =>
  draft.value.variables.some((variable) => variable.type === 'icon') ? mdiIconOptions() : [],
)
const viewOptions = computed<SelectOption[]>(() => store.config.views.map((view) => ({
  value: view.id,
  label: view.title,
  icon: view.icon,
})))

function nextVariableKey(): string {
  const existing = new Set(draft.value.variables.map((variable) => variable.key))
  if (!existing.has('entity')) return 'entity'
  let index = 1
  while (existing.has(`variable${index}`)) index++
  return `variable${index}`
}

function addVariable() {
  const key = nextVariableKey()
  draft.value.variables.push({
    id: newId('variable'),
    key,
    label: key === 'entity' ? t('customCards.variables.entityLabel') : key,
    type: key === 'entity' ? 'entity' : 'string',
    required: key === 'entity',
    domain: '',
    default: '',
  })
}

function removeVariable(id: string) {
  draft.value.variables = draft.value.variables.filter((variable) => variable.id !== id)
}

function changeVariableType(variable: CustomCardVariable, type: string) {
  variable.type = type as CustomCardVariableType
  variable.domain = type === 'entity' ? (variable.domain ?? '') : undefined
  // Entity fields sit above the collapsed boxes, so they never carry a group
  if (type === 'entity') variable.group = undefined
  variable.options = type === 'select' ? (variable.options?.length ? variable.options : ['option']) : undefined
  variable.optionLabels = undefined
  // A list repeats item fields instead of holding a single scalar default
  variable.itemFields = type === 'list'
    ? (variable.itemFields?.length ? variable.itemFields : defaultItemFields())
    : undefined
  variable.nestable = type === 'list' ? variable.nestable === true : undefined
  variable.default = type === 'list'
    ? undefined
    : type === 'boolean' ? false : type === 'number' ? 0 : type === 'icon' ? 'mdi:star' : ''
}

/** Starting point for a new list: a labelled entry pointing at a view. */
function defaultItemFields(): Array<Omit<CustomCardVariable, 'id'>> {
  return [
    { key: 'label', label: t('customCards.variables.itemLabel'), type: 'string', required: false },
    { key: 'icon', label: t('customCards.variables.itemIcon'), type: 'icon', required: false },
    { key: 'view', label: t('customCards.variables.itemView'), type: 'view', required: false },
  ]
}

function selectOptionsText(variable: CustomCardVariable): string {
  return (variable.options ?? []).join(', ')
}

function updateSelectOptions(variable: CustomCardVariable, value: string | number) {
  variable.options = String(value).split(',').map((option) => option.trim()).filter(Boolean)
  if (!variable.options.includes(String(variable.default ?? ''))) {
    variable.default = variable.options[0] ?? ''
  }
}

// ── Translations ─────────────────────────────────────────────
/**
 * A card may ship any number of languages. English always stays available as
 * the last fallback, the rest is up to the card author.
 */
const translationLanguages = computed<CardLanguage[]>(() => {
  const languages = Object.keys(draft.value.translations.languages)
  const fallback = draft.value.translations.fallback
  return [
    ...(languages.includes(fallback) ? [fallback] : []),
    ...languages.filter((language) => language !== fallback).sort(),
  ]
})

function languageLabel(language: CardLanguage): string {
  const name = cardLanguageName(language, locale.value)
  return name === language ? language : `${name} (${language})`
}

const fallbackOptions = computed<SelectOption[]>(() => {
  const languages = translationLanguages.value.includes(DEFAULT_TRANSLATION_FALLBACK)
    ? translationLanguages.value
    : [...translationLanguages.value, DEFAULT_TRANSLATION_FALLBACK]
  return languages.map((language) => ({ value: language, label: languageLabel(language) }))
})

const newLanguage = ref('')

const newLanguageInvalid = computed(() => {
  const language = newLanguage.value.trim()
  return language !== ''
    && (!isCardLanguage(language) || translationLanguages.value.includes(language))
})

function addLanguage() {
  const language = newLanguage.value.trim()
  if (!isCardLanguage(language) || translationLanguages.value.includes(language)) return
  // A new language starts with every key the card already uses, still empty
  draft.value.translations.languages[language] = Object.fromEntries(
    translationKeys.value.map((key) => [key, '']),
  )
  newLanguage.value = ''
}

async function removeLanguage(language: CardLanguage) {
  if (!(await confirmDialog(t('customCards.translations.removeLanguageConfirm', {
    language: languageLabel(language),
  })))) return
  delete draft.value.translations.languages[language]
  if (draft.value.translations.fallback === language) {
    draft.value.translations.fallback = DEFAULT_TRANSLATION_FALLBACK
  }
}

function catalogOf(language: CardLanguage): Record<string, string> {
  const languages = draft.value.translations.languages
  languages[language] ??= {}
  return languages[language]
}

/** Every key any language defines, in the order the fallback language lists them. */
const translationKeys = computed<string[]>(() => {
  const keys: string[] = []
  for (const language of translationLanguages.value) {
    for (const key of Object.keys(draft.value.translations.languages[language] ?? {})) {
      if (!keys.includes(key)) keys.push(key)
    }
  }
  return keys
})

/** Keys a card refers to but has not defined in any language yet. */
const referencedTranslationKeys = computed<string[]>(() => {
  const referenced = new Set<string>()
  const collect = (value: unknown) => {
    if (isTranslationKey(value)) referenced.add(value)
  }
  collect(draft.value.name)
  collect(draft.value.description)
  for (const variable of draft.value.variables) {
    collect(variable.label)
    collect(variable.group)
    for (const label of Object.values(variable.optionLabels ?? {})) collect(label)
    for (const item of variable.itemFields ?? []) collect(item.label)
  }
  for (const match of draft.value.javascript.matchAll(/['"`](translation\.[A-Za-z0-9_.]+)['"`]/g)) {
    referenced.add(match[1])
  }
  return [...referenced].filter((key) => !translationKeys.value.includes(key)).sort()
})

const newTranslationKey = ref('')

/** The card's own name may itself be a `translation.*` key. */
const draftName = computed(() =>
  isTranslationKey(draft.value.name)
    ? cardTranslation(draft.value.translations, draft.value.name, locale.value)
    : draft.value.name,
)

function addTranslationKey(key = newTranslationKey.value) {
  const trimmed = key.trim()
  const full = isTranslationKey(trimmed) ? trimmed : `${TRANSLATION_PREFIX}${trimmed}`
  if (!/^translation\.[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/.test(full)) return
  for (const language of translationLanguages.value) catalogOf(language)[full] ??= ''
  newTranslationKey.value = ''
}

function removeTranslationKey(key: string) {
  for (const language of translationLanguages.value) delete catalogOf(language)[key]
}

function setTranslation(language: CardLanguage, key: string, value: string | number) {
  catalogOf(language)[key] = String(value)
}

/** A key is only really translated once some language provides a text. */
function translationMissing(key: string): boolean {
  return translationLanguages.value.every(
    (language) => !draft.value.translations.languages[language]?.[key],
  )
}

function serializeVariables(): string {
  return JSON.stringify(draft.value.variables.map(({ id: _id, ...variable }) => variable), null, 2)
}

function portableVariables(): Array<Omit<CustomCardVariable, 'id'>> {
  return draft.value.variables.map(({ id: _id, ...variable }) => variable)
}

function defaultVariableValue(type: CustomCardVariableType): string | number | boolean {
  if (type === 'boolean') return false
  if (type === 'number') return 0
  if (type === 'icon') return 'mdi:star'
  return ''
}

function parseVariablesJson(source: string): CustomCardVariable[] {
  const parsed: unknown = JSON.parse(source)
  if (!Array.isArray(parsed)) throw new Error(t('customCards.variables.jsonArrayError'))

  const allowedTypes: CustomCardVariableType[] = [
    'entity', 'string', 'number', 'boolean', 'icon', 'view', 'select', 'list',
  ]
  const existingIds = new Map(draft.value.variables.map((variable) => [variable.key, variable.id]))
  const keys = new Set<string>()

  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(t('customCards.variables.jsonEntryError', { index: index + 1 }))
    }
    const value = entry as Record<string, unknown>
    const key = typeof value.key === 'string' ? value.key.trim() : ''
    const label = typeof value.label === 'string' ? value.label.trim() : ''
    const type = value.type as CustomCardVariableType
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
      || keys.has(key)
      || ['__proto__', 'prototype', 'constructor'].includes(key)) {
      throw new Error(t('customCards.variables.jsonKeyError', { index: index + 1 }))
    }
    if (!label || !allowedTypes.includes(type)) {
      throw new Error(t('customCards.variables.jsonEntryError', { index: index + 1 }))
    }
    const rawDefault = value.default
    const defaultValue: string | number | boolean = rawDefault === undefined || rawDefault === null
      ? defaultVariableValue(type)
      : rawDefault as string | number | boolean
    if (type !== 'list' && ((type === 'number' && typeof defaultValue !== 'number')
      || (type === 'boolean' && typeof defaultValue !== 'boolean')
      || (!['number', 'boolean'].includes(type) && typeof defaultValue !== 'string'))) {
      throw new Error(t('customCards.variables.jsonDefaultError', { index: index + 1 }))
    }
    const options = type === 'select' && Array.isArray(value.options)
      ? value.options.filter((option): option is string => typeof option === 'string' && option !== '')
      : undefined
    if (type === 'select' && !options?.length) {
      throw new Error(t('customCards.variables.jsonEntryError', { index: index + 1 }))
    }
    const itemFields = type === 'list' ? parseItemFields(value.itemFields, index) : undefined
    keys.add(key)
    const group = typeof value.group === 'string' && value.group.trim()
      ? value.group.trim()
      : undefined
    return {
      id: existingIds.get(key) ?? newId('variable'),
      key,
      label,
      group,
      type,
      required: value.required === true,
      domain: type === 'entity' && typeof value.domain === 'string' ? value.domain : undefined,
      default: type === 'list' ? undefined : defaultValue,
      options,
      optionLabels: type === 'select' && value.optionLabels && typeof value.optionLabels === 'object'
        ? value.optionLabels as Record<string, string>
        : undefined,
      min: type === 'number' && typeof value.min === 'number' ? value.min : undefined,
      max: type === 'number' && typeof value.max === 'number' ? value.max : undefined,
      step: type === 'number' && typeof value.step === 'number' ? value.step : undefined,
      itemFields,
      nestable: type === 'list' ? value.nestable === true : undefined,
    }
  })
}

/** Item fields repeat scalar variables — nested lists are rejected. */
function parseItemFields(value: unknown, index: number): Array<Omit<CustomCardVariable, 'id'>> {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(t('customCards.variables.jsonItemFieldsError', { index: index + 1 }))
  }
  return value.map((entry) => {
    const field = entry as Record<string, unknown> | null
    const key = field && typeof field.key === 'string' ? field.key.trim() : ''
    const label = field && typeof field.label === 'string' ? field.label.trim() : ''
    const type = field?.type as CustomCardVariableType
    const scalarTypes: CustomCardVariableType[] = [
      'entity', 'string', 'number', 'boolean', 'icon', 'view', 'select',
    ]
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) || !label || !scalarTypes.includes(type)) {
      throw new Error(t('customCards.variables.jsonItemFieldsError', { index: index + 1 }))
    }
    return {
      key,
      label,
      type,
      required: field?.required === true,
      options: type === 'select' && Array.isArray(field?.options)
        ? (field.options as unknown[]).filter((o): o is string => typeof o === 'string' && o !== '')
        : undefined,
    }
  })
}

function updateVariableJson(value: string) {
  variableJsonText.value = value
  try {
    draft.value.variables = parseVariablesJson(value)
    variableJsonError.value = ''
  } catch (error) {
    variableJsonError.value = error instanceof SyntaxError
      ? t('customCards.variables.jsonSyntaxError', { message: error.message })
      : error instanceof Error ? error.message : t('customCards.variables.jsonInvalid')
  }
}

function changeVariableEditorMode(value: string) {
  if (value === 'visual' && variableJsonError.value) return
  if (value === 'json') variableJsonText.value = serializeVariables()
  variableEditorMode.value = value
}

function fullCodeMetadata(): FullCodeMetadata {
  return {
    format: 'vue-panel-card',
    formatVersion: 2,
    apiVersion: 1,
    manufacturer: draft.value.manufacturer,
    cardName: draft.value.cardName,
    name: draft.value.name,
    description: draft.value.description,
    icon: draft.value.icon,
    group: draft.value.group,
    areas: [...draft.value.areas],
    capabilities: [...draft.value.capabilities],
    defaultSize: { ...draft.value.defaultSize },
    defaultResponsive: { ...draft.value.defaultResponsive },
    fullRow: draft.value.fullRow,
    variables: portableVariables(),
  }
}

function serializeFullCode(): string {
  const metadata = JSON.stringify(fullCodeMetadata(), null, 2)
    .replace(/<\/script/gi, '<\\/script')
  const translations = JSON.stringify(draft.value.translations, null, 2)
    .replace(/<\/script/gi, '<\\/script')
  const scriptEnd = '<' + '/script>'
  return `<script data-vue-panel-config>
const vuePanelCard = ${metadata};
${scriptEnd}

<script data-vue-panel-translation>
const vuePanelTranslations = ${translations};
${scriptEnd}

<template data-vue-panel-html>
${draft.value.html}
</template>

<style data-vue-panel-css>
${draft.value.css}
</style>

<script data-vue-panel-javascript>
${draft.value.javascript}
${scriptEnd}`
}

/** Translation catalogs of the pasted document — a missing block is empty. */
function translationsFromFullCode(parsed: unknown): CardTranslations {
  const value = (parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed
    : {}) as Record<string, unknown>
  const source = (value.languages && typeof value.languages === 'object'
    ? value.languages
    : {}) as Record<string, unknown>
  const languages: Record<string, Record<string, string>> = {}
  for (const [language, entries] of Object.entries(source)) {
    if (!isCardLanguage(language)) continue
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) continue
    languages[language] = Object.fromEntries(
      Object.entries(entries as Record<string, unknown>)
        .filter(([key, text]) => isTranslationKey(key) && typeof text === 'string')
        .map(([key, text]) => [key, text as string]),
    )
  }
  if (!Object.keys(languages).length) languages[DEFAULT_TRANSLATION_FALLBACK] = {}
  const fallback = typeof value.fallback === 'string' && languages[value.fallback]
    ? value.fallback
    : DEFAULT_TRANSLATION_FALLBACK
  return { fallback, languages }
}

function definitionFromFullCode(
  parsed: unknown,
  translations: unknown,
  html: unknown,
  css: unknown,
  javascript: unknown,
): CustomCardDefinition {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(t('customCards.fullCode.documentError'))
  }
  const value = parsed as Record<string, unknown>
  if (value.format !== 'vue-panel-card' || value.formatVersion !== 2 || value.apiVersion !== 1) {
    throw new Error(t('customCards.fullCode.formatError'))
  }
  if (typeof value.manufacturer !== 'string'
    || typeof value.cardName !== 'string'
    || typeof value.name !== 'string'
    || typeof value.description !== 'string'
    || typeof value.icon !== 'string'
    || typeof value.group !== 'string'
    || typeof html !== 'string'
    || typeof css !== 'string'
    || typeof javascript !== 'string'
    || !Array.isArray(value.areas)
    || !Array.isArray(value.capabilities)
    || !Array.isArray(value.variables)
    || !value.defaultSize
    || typeof value.defaultSize !== 'object'
    || Array.isArray(value.defaultSize)
    || !value.defaultResponsive
    || typeof value.defaultResponsive !== 'object'
    || Array.isArray(value.defaultResponsive)
    || typeof value.fullRow !== 'boolean') {
    throw new Error(t('customCards.fullCode.documentError'))
  }
  const size = value.defaultSize as Record<string, unknown>
  const responsive = value.defaultResponsive as Record<string, unknown>
  const variables = parseVariablesJson(JSON.stringify(value.variables))
  return {
    id: `${value.manufacturer}/${value.cardName}`,
    format: 'vue-panel-card',
    formatVersion: 2,
    apiVersion: 1,
    manufacturer: value.manufacturer,
    cardName: value.cardName,
    name: value.name,
    description: value.description,
    icon: value.icon,
    group: value.group,
    translations: translationsFromFullCode(translations),
    areas: value.areas as CustomCardDefinition['areas'],
    capabilities: value.capabilities as CustomCardDefinition['capabilities'],
    defaultSize: {
      cols: positiveInteger(Number(size.cols), 1),
      rows: positiveInteger(Number(size.rows), 1),
      width: positiveInteger(Number(size.width), 140),
      height: positiveInteger(Number(size.height), 120),
    },
    defaultResponsive: {
      mobile: responsive.mobile === true,
      tablet: responsive.tablet === true,
      desktop: responsive.desktop === true,
      mobileMax: positiveInteger(Number(responsive.mobileMax), 767),
      tabletMax: positiveInteger(Number(responsive.tabletMax), 1023),
    },
    fullRow: value.fullRow,
    variables,
    html,
    css,
    javascript,
    contentHash: draft.value.contentHash,
    writable: draft.value.writable,
    source: draft.value.source,
  }
}

function sectionContent(source: string, pattern: RegExp): string {
  const match = source.match(pattern)
  if (!match || match[1] === undefined) throw new Error(t('customCards.fullCode.documentError'))
  return match[1].replace(/^\r?\n/, '').replace(/\r?\n$/, '')
}

function parseJavaScriptMetadata(source: string, constant = 'vuePanelCard'): unknown {
  const declaration = new RegExp(`^\\s*const\\s+${constant}\\s*=\\s*`)
  if (!declaration.test(source)) throw new Error(t('customCards.fullCode.documentError'))
  let json = source.replace(declaration, '').trim()
  if (json.endsWith(';')) json = json.slice(0, -1).trim()
  return JSON.parse(json)
}

function parseFullCode(source: string): CustomCardDefinition {
  const currentMetadata = source.match(
    /<script\s+data-vue-panel-config>([\s\S]*?)<\/script>/i,
  )
  const metadata = currentMetadata?.[1] !== undefined
    ? parseJavaScriptMetadata(currentMetadata[1])
    : undefined
  if (!metadata) throw new Error(t('customCards.fullCode.documentError'))
  // The translation block is optional — older documents simply carry no texts
  const currentTranslations = source.match(
    /<script\s+data-vue-panel-translation>([\s\S]*?)<\/script>/i,
  )
  const translations = currentTranslations?.[1] !== undefined
    ? parseJavaScriptMetadata(currentTranslations[1], 'vuePanelTranslations')
    : undefined
  const html = sectionContent(source, /<template\s+data-vue-panel-html>([\s\S]*?)<\/template>/i)
  const css = sectionContent(source, /<style\s+data-vue-panel-css>([\s\S]*?)<\/style>/i)
  const javascript = sectionContent(
    source,
    /<script\s+data-vue-panel-javascript>([\s\S]*?)<\/script>/i,
  )
  return definitionFromFullCode(metadata, translations, html, css, javascript)
}

function updateFullCode(value: string) {
  fullCodeText.value = value
  try {
    draft.value = parseFullCode(value)
    variableJsonText.value = serializeVariables()
    variableJsonError.value = ''
    fullCodeError.value = ''
  } catch (error) {
    fullCodeError.value = error instanceof SyntaxError
      ? t('customCards.fullCode.syntaxError', { message: error.message })
      : error instanceof Error ? error.message : t('customCards.fullCode.documentError')
  }
}

function changeTab(value: string) {
  if (tab.value === 'fullCode' && fullCodeError.value && value !== 'fullCode') return
  if (value === 'fullCode') fullCodeText.value = serializeFullCode()
  tab.value = value
}

function exportFullCode() {
  if (fullCodeError.value) return
  const content = fullCodeText.value || serializeFullCode()
  const blob = new Blob([content], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const filename = (draft.value.name || 'custom-card')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'custom-card'
  anchor.href = url
  anchor.download = `${filename}.vue-panel-card.html`
  anchor.click()
  URL.revokeObjectURL(url)
}

function openImport() {
  importInput.value?.click()
}

async function importFullCode(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size > 512 * 1024) {
    fullCodeError.value = t('customCards.fullCode.fileTooLarge')
    tab.value = 'fullCode'
    return
  }
  tab.value = 'fullCode'
  updateFullCode(await file.text())
  if (!fullCodeError.value) {
    draft.value.contentHash = undefined
    draft.value.writable = true
    draft.value.source = 'local'
    importMode.value = true
  }
}

variableJsonText.value = serializeVariables()
fullCodeText.value = serializeFullCode()
watch(() => draft.value.variables, () => {
  if (variableEditorMode.value !== 'visual') return
  variableJsonText.value = serializeVariables()
  variableJsonError.value = ''
}, { deep: true })
watch(draft, () => {
  if (tab.value === 'fullCode' || fullCodeFullscreen.value) return
  fullCodeText.value = serializeFullCode()
  fullCodeError.value = ''
}, { deep: true })

function variableKeyInvalid(variable: CustomCardVariable): boolean {
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(variable.key)) return true
  if (['__proto__', 'prototype', 'constructor'].includes(variable.key)) return true
  return draft.value.variables.some(
    (candidate) => candidate.id !== variable.id && candidate.key === variable.key,
  )
}

const variablesInvalid = computed(() => draft.value.variables.some(
  (variable) => variableKeyInvalid(variable)
    || !variable.label.trim()
    || (variable.type === 'select' && !variable.options?.length)
    || (variable.type === 'list' && !variable.itemFields?.length),
) || Boolean(variableJsonError.value))

const previewConfig = computed<Record<string, unknown>>(() => Object.fromEntries([
  ...draft.value.variables.map((variable) => [variable.key, variable.default]),
]))

const identityPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const identityType = computed(() => `${draft.value.manufacturer}/${draft.value.cardName}`)
const duplicateIdentity = computed(() => Boolean(
  cardRegistry[identityType.value]?.portable
    && identityType.value !== props.definition?.id,
))
const identityInvalid = computed(() => !identityPattern.test(draft.value.manufacturer)
  || draft.value.manufacturer === 'vue-panel'
  || !identityPattern.test(draft.value.cardName)
  || duplicateIdentity.value)
const nameInvalid = computed(() => validationAttempted.value && !draft.value.name.trim())
const metadataInvalid = computed(() => draft.value.areas.length === 0
  || !/^mdi:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.value.icon)
  || !draft.value.group.trim()
  || draft.value.defaultResponsive.tabletMax <= draft.value.defaultResponsive.mobileMax)
const readOnly = computed(() => Boolean(props.definition && !props.definition.writable && !duplicating.value))

function sourceBytes(): number {
  return new TextEncoder().encode(serializeFullCode()).byteLength
}

const definitionTooLarge = computed(() => sourceBytes() > 512 * 1024)
const sourceSize = computed(() => `${(sourceBytes() / 1024).toFixed(1)} KB`)

function positiveInteger(value: number | string, fallback: number): number {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.round(number) : fallback
}

async function save() {
  validationAttempted.value = true
  if (readOnly.value || nameInvalid.value || identityInvalid.value || metadataInvalid.value
    || variablesInvalid.value || fullCodeError.value || definitionTooLarge.value) return
  draft.value.manufacturer = draft.value.manufacturer.trim()
  draft.value.cardName = draft.value.cardName.trim()
  draft.value.id = `${draft.value.manufacturer}/${draft.value.cardName}`
  draft.value.name = draft.value.name.trim()
  draft.value.icon = draft.value.icon.trim() || 'mdi:code-tags'
  draft.value.group = draft.value.group.trim() || draft.value.manufacturer
  draft.value.variables = draft.value.variables.map((variable) => ({
    ...variable,
    key: variable.key.trim(),
    label: variable.label.trim(),
    domain: variable.type === 'entity' ? variable.domain?.trim() : undefined,
  }))
  draft.value.defaultSize = {
    cols: positiveInteger(draft.value.defaultSize.cols, 1),
    rows: positiveInteger(draft.value.defaultSize.rows, 1),
    width: positiveInteger(draft.value.defaultSize.width, 140),
    height: positiveInteger(draft.value.defaultSize.height, 120),
  }
  const document = serializeFullCode()
  try {
    const saved = props.definition && props.definition.writable && !duplicating.value
      ? await updatePortableCard(props.definition.id, document, props.definition.contentHash ?? '')
      : importMode.value
        ? await importPortableCard(document)
        : await createPortableCard(document)
    draft.value.contentHash = saved.contentHash
    draft.value.writable = saved.writable
    draft.value.source = saved.source
    await syncPortableCardCatalog()
    emit('saved', draft.value)
    emit('close')
  } catch (error) {
    if (isCardRevisionConflict(error) && props.definition) {
      const choice = await choiceDialog(t('customCards.errors.revisionConflict'), [
        { value: 'copy', label: t('persistence.saveCopy') },
        { value: 'reload', label: t('persistence.reload'), variant: 'primary' },
      ])
      if (choice === 'copy') exportFullCode()
      if (choice === 'reload') {
        draft.value = editorDefinitionFromDocument(await getPortableCard(props.definition.id))
        fullCodeText.value = serializeFullCode()
      }
      return
    }
    await alertDialog(t('customCards.errors.saveFailed', { message: String(error) }))
  }
}

async function remove() {
  if (!props.definition?.writable || !props.definition.contentHash) return
  if (!(await confirmDialog(t('customCards.deleteConfirm', { name: draftName.value })))) return
  try {
    await deletePortableCard(props.definition.id, props.definition.contentHash)
    await syncPortableCardCatalog()
    emit('close')
  } catch (error) {
    await alertDialog(t('customCards.errors.deleteFailed', { message: String(error) }))
  }
}

function beginDuplicate() {
  const suffix = draft.value.cardName.endsWith('-copy') ? '2' : 'copy'
  draft.value.manufacturer = 'local'
  draft.value.cardName = `${draft.value.cardName}-${suffix}`
  draft.value.group = 'local'
  draft.value.id = `local/${draft.value.cardName}`
  draft.value.contentHash = undefined
  draft.value.writable = true
  draft.value.source = 'local'
  duplicating.value = true
  fullCodeText.value = serializeFullCode()
}

const previewStyle = computed(() => ({
  width: `${positiveInteger(draft.value.defaultSize.width, 140)}px`,
  height: `${positiveInteger(draft.value.defaultSize.height, 120)}px`,
}))
</script>

<template>
  <BaseDialog
    :title="definition ? t('customCards.editTitle', { name: draftName }) : t('customCards.newTitle')"
    :size="fullCodeFullscreen ? 'full' : 'xl'"
    @close="emit('close')"
  >
    <BaseTabs :model-value="tab" :items="tabs" class="dialog-tabs" @update:model-value="changeTab" />

    <div
      ref="editorLayout"
      class="custom-editor-layout"
      :class="{ 'is-fullscreen': fullCodeFullscreen, 'is-resizing': splitterDragging }"
      :style="editorLayoutStyle"
    >
      <div class="editor-pane">
        <div v-show="tab === 'settings'" class="settings-form">
          <div class="identity-grid">
            <label class="field">
              <span>{{ t('customCards.fields.manufacturer') }} *</span>
              <BaseInput
                v-model="draft.manufacturer"
                :disabled="Boolean(definition && !duplicating)"
                :invalid="validationAttempted && identityInvalid"
                placeholder="local"
                :spellcheck="false"
              />
            </label>
            <label class="field">
              <span>{{ t('customCards.fields.cardName') }} *</span>
              <BaseInput
                v-model="draft.cardName"
                :disabled="Boolean(definition && !duplicating)"
                :invalid="validationAttempted && identityInvalid"
                placeholder="my-card"
                :spellcheck="false"
              />
            </label>
          </div>
          <small v-if="validationAttempted && identityInvalid" class="field-error">
            {{ duplicateIdentity ? t('customCards.errors.duplicateIdentity') : t('customCards.errors.identityInvalid') }}
          </small>
          <label class="field">
            <span>{{ t('customCards.fields.name') }} *</span>
            <BaseInput v-model="draft.name" :invalid="nameInvalid" />
            <small v-if="validationAttempted && !draft.name.trim()" class="field-error">
              {{ t('customCards.errors.nameRequired') }}
            </small>
          </label>
          <label class="field">
            <span>{{ t('customCards.fields.description') }}</span>
            <BaseInput v-model="draft.description" />
          </label>
          <label class="field">
            <span>{{ t('customCards.fields.icon') }}</span>
            <div class="icon-field">
              <span class="icon-preview"><MdiIcon :icon="draft.icon || 'mdi:code-tags'" :size="20" /></span>
              <BaseInput v-model="draft.icon" placeholder="mdi:code-tags" />
            </div>
          </label>
          <label class="field">
            <span>{{ t('customCards.fields.group') }}</span>
            <BaseInput v-model="draft.group" placeholder="local" />
          </label>
          <div class="metadata-group">
            <strong>{{ t('customCards.fields.areas') }}</strong>
            <label v-for="option in areaOptions" :key="option.value" class="check-row">
              <span>{{ option.label }}</span>
              <BaseCheckbox
                :model-value="draft.areas.includes(option.value)"
                @update:model-value="draft.areas = toggleArrayValue(draft.areas, option.value, $event)"
              />
            </label>
          </div>
          <div class="metadata-group">
            <strong>{{ t('customCards.fields.capabilities') }}</strong>
            <label v-for="capability in capabilityOptions" :key="capability" class="check-row">
              <code>{{ capability }}</code>
              <BaseCheckbox
                :model-value="draft.capabilities.includes(capability)"
                @update:model-value="draft.capabilities = toggleArrayValue(draft.capabilities, capability, $event)"
              />
            </label>
          </div>
          <label class="check-row">
            <span>{{ t('customCards.fields.fullRow') }}</span>
            <BaseCheckbox v-model="draft.fullRow" />
          </label>
          <small v-if="validationAttempted && metadataInvalid" class="field-error">
            {{ t('customCards.errors.metadataInvalid') }}
          </small>
          <div class="size-group">
            <div class="size-heading">
              <strong>{{ t('customCards.fields.defaultSize') }}</strong>
              <small>{{ t('customCards.fields.defaultSizeHint') }}</small>
            </div>
            <label class="field">
              <span>{{ t('customCards.fields.width') }}</span>
              <BaseInput v-model="draft.defaultSize.width" type="number" :min="40" :max="4000" />
            </label>
            <label class="field">
              <span>{{ t('customCards.fields.height') }}</span>
              <BaseInput v-model="draft.defaultSize.height" type="number" :min="40" :max="4000" />
            </label>
            <label class="field">
              <span>{{ t('customCards.fields.columns') }}</span>
              <BaseInput v-model="draft.defaultSize.cols" type="number" :min="1" :max="12" />
            </label>
            <label class="field">
              <span>{{ t('customCards.fields.rows') }}</span>
              <BaseInput v-model="draft.defaultSize.rows" type="number" :min="1" :max="12" />
            </label>
          </div>
        </div>

        <div v-show="tab === 'variables'" class="variables-pane">
          <div class="variables-intro">
            <div>
              <strong>{{ t('customCards.variables.title') }}</strong>
              <p>{{ t('customCards.variables.hint') }}</p>
            </div>
            <BaseButton v-if="variableEditorMode === 'visual'" size="sm" @click="addVariable">
              <MdiIcon icon="mdi:plus" :size="16" />
              {{ t('customCards.variables.add') }}
            </BaseButton>
          </div>

          <BaseTabs
            :model-value="variableEditorMode"
            :items="variableEditorTabs"
            class="variable-mode-tabs"
            @update:model-value="changeVariableEditorMode"
          />

          <template v-if="variableEditorMode === 'visual'">
            <div v-if="draft.variables.length" class="variable-list">
              <BaseVariableCard
                v-for="(variable, index) in draft.variables"
                :key="variable.id"
                :title="`vuePanel.config.${variable.key || 'variable'}`"
                :marker="index + 1"
                :remove-label="t('common.delete')"
                default-open
                @remove="removeVariable(variable.id)"
              >
                <div class="variable-fields">
                  <label class="field">
                    <span>{{ t('customCards.variables.key') }} *</span>
                    <BaseInput v-model="variable.key" :invalid="variableKeyInvalid(variable)" :spellcheck="false" />
                    <small v-if="variableKeyInvalid(variable)" class="field-error">
                      {{ t('customCards.variables.keyError') }}
                    </small>
                  </label>
                  <label class="field">
                    <span>{{ t('customCards.variables.label') }} *</span>
                    <BaseInput v-model="variable.label" :invalid="validationAttempted && !variable.label.trim()" />
                  </label>
                  <label v-if="variable.type !== 'entity'" class="field">
                    <span>{{ t('customCards.variables.group') }}</span>
                    <BaseInput
                      :model-value="variable.group ?? ''"
                      :placeholder="t('editor.fieldGroupOther')"
                      @update:model-value="variable.group = String($event).trim() || undefined"
                    />
                    <small class="field-hint">{{ t('customCards.variables.groupHint') }}</small>
                  </label>
                  <div class="field">
                    <span>{{ t('customCards.variables.type') }}</span>
                    <BaseSelectMenu
                      :model-value="variable.type"
                      :options="variableTypeOptions"
                      @update:model-value="changeVariableType(variable, $event)"
                    />
                  </div>
                  <label v-if="variable.type === 'entity'" class="field">
                    <span>{{ t('customCards.variables.domain') }}</span>
                    <BaseInput
                      :model-value="variable.domain ?? ''"
                      placeholder="light"
                      :spellcheck="false"
                      @update:model-value="variable.domain = String($event)"
                    />
                  </label>
                  <label v-if="variable.type === 'select'" class="field">
                    <span>{{ t('customCards.variables.options') }}</span>
                    <BaseInput
                      :model-value="selectOptionsText(variable)"
                      placeholder="option-one, option-two"
                      @update:model-value="updateSelectOptions(variable, $event)"
                    />
                  </label>
                  <div v-if="variable.type === 'list'" class="field">
                    <span>{{ t('customCards.variables.itemFields') }}</span>
                    <small class="field-hint">
                      {{ t('customCards.variables.itemFieldsHint', {
                        fields: (variable.itemFields ?? []).map((f) => f.key).join(', '),
                      }) }}
                    </small>
                  </div>
                  <div v-else class="field default-field">
                    <span>{{ t('customCards.variables.defaultValue') }}</span>
                    <EntityPicker
                      v-if="variable.type === 'entity'"
                      :model-value="String(variable.default ?? '')"
                      :domain="variable.domain || undefined"
                      @update:model-value="variable.default = $event"
                    />
                    <BaseSelectMenu
                      v-else-if="variable.type === 'icon'"
                      :model-value="String(variable.default ?? '')"
                      :options="iconOptions"
                      searchable
                      allow-custom
                      custom-prefix="mdi:"
                      clearable
                      @update:model-value="variable.default = $event"
                    />
                    <BaseSelectMenu
                      v-else-if="variable.type === 'view'"
                      :model-value="String(variable.default ?? '')"
                      :options="viewOptions"
                      clearable
                      @update:model-value="variable.default = $event"
                    />
                    <BaseSelectMenu
                      v-else-if="variable.type === 'select'"
                      :model-value="String(variable.default ?? '')"
                      :options="(variable.options ?? []).map((option) => ({ value: option, label: variable.optionLabels?.[option] ?? option }))"
                      @update:model-value="variable.default = $event"
                    />
                    <BaseCheckbox
                      v-else-if="variable.type === 'boolean'"
                      :model-value="variable.default === true"
                      :label="variable.default === true ? t('customCards.variables.enabled') : t('customCards.variables.disabled')"
                      @update:model-value="variable.default = $event"
                    />
                    <BaseInput
                      v-else-if="variable.type === 'number'"
                      :model-value="Number(variable.default ?? 0)"
                      type="number"
                      @update:model-value="variable.default = Number($event)"
                    />
                    <BaseInput
                      v-else
                      :model-value="String(variable.default ?? '')"
                      @update:model-value="variable.default = String($event)"
                    />
                  </div>
                  <div class="required-field">
                    <span>{{ t('customCards.variables.required') }}</span>
                    <BaseCheckbox v-model="variable.required" />
                  </div>
                </div>
              </BaseVariableCard>
            </div>
            <div v-else class="variables-empty">
              <MdiIcon icon="mdi:variable" :size="28" />
              <strong>{{ t('customCards.variables.emptyTitle') }}</strong>
              <span>{{ t('customCards.variables.emptyHint') }}</span>
            </div>
          </template>

          <div v-else class="variable-json-pane">
            <p>{{ t('customCards.variables.jsonHint') }}</p>
            <BaseCodeEditor
              :model-value="variableJsonText"
              language="json"
              min-height="360px"
              @update:model-value="updateVariableJson"
            />
            <small v-if="variableJsonError" class="field-error variable-json-error">
              {{ variableJsonError }}
            </small>
          </div>
        </div>

        <div v-show="tab === 'translations'" class="translations-pane">
          <div class="variables-intro">
            <div>
              <strong>{{ t('customCards.translations.title') }}</strong>
              <p>{{ t('customCards.translations.hint') }}</p>
            </div>
          </div>

          <div class="translation-languages">
            <div class="field fallback-field">
              <span>{{ t('customCards.translations.fallback') }}</span>
              <BaseSelectMenu
                :model-value="draft.translations.fallback"
                :options="fallbackOptions"
                @update:model-value="draft.translations.fallback = $event as CardLanguage"
              />
              <small class="field-hint">{{ t('customCards.translations.fallbackHint') }}</small>
            </div>

            <div class="field language-field">
              <span>{{ t('customCards.translations.languages') }}</span>
              <div class="language-chips">
                <span
                  v-for="language in translationLanguages"
                  :key="language"
                  class="language-chip"
                  :class="{ 'is-fallback': language === draft.translations.fallback }"
                >
                  {{ languageLabel(language) }}
                  <button
                    v-if="translationLanguages.length > 1"
                    type="button"
                    class="translation-remove"
                    :title="t('customCards.translations.removeLanguage')"
                    @click="removeLanguage(language)"
                  >
                    <MdiIcon icon="mdi:close" :size="13" />
                  </button>
                </span>
              </div>
              <div class="translation-add">
                <BaseInput
                  v-model="newLanguage"
                  placeholder="fr"
                  :spellcheck="false"
                  :invalid="newLanguageInvalid"
                  @keyup.enter="addLanguage()"
                />
                <BaseButton size="sm" :disabled="newLanguageInvalid" @click="addLanguage()">
                  <MdiIcon icon="mdi:plus" :size="16" />
                  {{ t('customCards.translations.addLanguage') }}
                </BaseButton>
              </div>
              <small class="field-hint">{{ t('customCards.translations.addLanguageHint') }}</small>
            </div>
          </div>

          <div class="translation-add">
            <BaseInput
              v-model="newTranslationKey"
              :placeholder="`${TRANSLATION_PREFIX}name`"
              :spellcheck="false"
              @keyup.enter="addTranslationKey()"
            />
            <BaseButton size="sm" @click="addTranslationKey()">
              <MdiIcon icon="mdi:plus" :size="16" />
              {{ t('customCards.translations.addKey') }}
            </BaseButton>
          </div>

          <div v-if="referencedTranslationKeys.length" class="translation-missing">
            <small>{{ t('customCards.translations.missingKeys') }}</small>
            <button
              v-for="key in referencedTranslationKeys"
              :key="key"
              type="button"
              class="translation-chip"
              @click="addTranslationKey(key)"
            >
              <MdiIcon icon="mdi:plus" :size="13" />{{ key }}
            </button>
          </div>

          <div v-if="translationKeys.length" class="translation-list">
            <div
              v-for="key in translationKeys"
              :key="key"
              class="translation-row"
              :class="{ 'is-missing': translationMissing(key) }"
            >
              <div class="translation-key">
                <code>{{ key }}</code>
                <button
                  type="button"
                  class="translation-remove"
                  :title="t('common.delete')"
                  @click="removeTranslationKey(key)"
                >
                  <MdiIcon icon="mdi:delete-outline" :size="16" />
                </button>
              </div>
              <label
                v-for="language in translationLanguages"
                :key="language"
                class="field"
              >
                <span>{{ languageLabel(language) }}</span>
                <BaseInput
                  :model-value="draft.translations.languages[language]?.[key] ?? ''"
                  @update:model-value="setTranslation(language, key, $event)"
                />
              </label>
            </div>
          </div>
          <div v-else class="variables-empty">
            <MdiIcon icon="mdi:translate" :size="28" />
            <strong>{{ t('customCards.translations.emptyTitle') }}</strong>
            <span>{{ t('customCards.translations.emptyHint') }}</span>
          </div>
        </div>

        <div v-show="tab === 'html'" class="code-pane">
          <p>{{ t('customCards.hints.html') }}</p>
          <BaseCodeEditor v-model="draft.html" language="html" min-height="360px" />
        </div>
        <div v-show="tab === 'css'" class="code-pane">
          <p>{{ t('customCards.hints.css') }}</p>
          <BaseCodeEditor v-model="draft.css" language="css" min-height="360px" />
        </div>
        <div v-show="tab === 'javascript'" class="code-pane">
          <p>{{ t('customCards.hints.javascript') }}</p>
          <BaseCodeEditor v-model="draft.javascript" language="javascript" min-height="320px" />
          <div class="api-reference">
            <code>vuePanel.getEntity(entityId)</code>
            <code>vuePanel.getIcon(icon, options)</code>
            <code>vuePanel.subscribeEntity(entityId, callback)</code>
            <code>vuePanel.callService(domain, service, data, target)</code>
            <code>vuePanel.config</code>
            <code>vuePanel.t('translation.key')</code>
            <code>vuePanel.language</code>
          </div>
        </div>

        <div v-show="tab === 'fullCode'" class="full-code-pane">
          <div class="full-code-toolbar">
            <div>
              <strong>{{ t('customCards.fullCode.title') }}</strong>
              <p>{{ t('customCards.fullCode.hint') }}</p>
            </div>
            <div class="full-code-actions">
              <BaseButton size="sm" @click="openImport">
                <MdiIcon icon="mdi:upload" :size="16" />
                {{ t('customCards.fullCode.import') }}
              </BaseButton>
              <BaseButton size="sm" :disabled="Boolean(fullCodeError)" @click="exportFullCode">
                <MdiIcon icon="mdi:download" :size="16" />
                {{ t('customCards.fullCode.export') }}
              </BaseButton>
              <BaseButton size="sm" @click="fullCodeFullscreen = !fullCodeFullscreen">
                <MdiIcon :icon="fullCodeFullscreen ? 'mdi:fullscreen-exit' : 'mdi:fullscreen'" :size="17" />
                {{ t(fullCodeFullscreen ? 'customCards.fullCode.exitFullscreen' : 'customCards.fullCode.fullscreen') }}
              </BaseButton>
            </div>
          </div>
          <BaseCodeEditor
            class="full-code-editor"
            :model-value="fullCodeText"
            language="html"
            :min-height="fullCodeFullscreen ? 'calc(100dvh - 220px)' : '420px'"
            @update:model-value="updateFullCode"
          />
          <small v-if="fullCodeError" class="field-error full-code-error">{{ fullCodeError }}</small>
        </div>

        <div v-if="definitionTooLarge" class="source-error">
          {{ t('customCards.errors.cardTooLarge') }}
        </div>
      </div>

      <div
        class="editor-preview-splitter"
        role="separator"
        aria-orientation="vertical"
        :aria-label="t('customCards.resizePreview')"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="Math.round(editorShare)"
        tabindex="0"
        @keydown="resizeWithKeyboard"
        @pointerdown.prevent="startSplitter"
        @pointermove.prevent="moveSplitter"
        @pointerup="stopSplitter"
        @pointercancel="stopSplitter"
      >
        <span />
      </div>

      <aside class="preview-panel">
        <div class="preview-head">
          <span>{{ t('common.preview') }}</span>
          <span class="preview-badge"><MdiIcon icon="mdi:palette-outline" :size="13" /> {{ t('customCards.previewThemed') }}</span>
        </div>
        <div class="preview-stage">
          <div class="preview-card" :style="previewStyle">
            <CardRuntime :definition="draft" :config="previewConfig" preview />
          </div>
        </div>
        <div class="preview-foot">
          <span>{{ draft.defaultSize.width }} x {{ draft.defaultSize.height }} px</span>
          <span>{{ sourceSize }}</span>
        </div>
      </aside>
    </div>

    <template #footer>
      <BaseButton v-if="definition?.writable" variant="danger" class="delete-button" @click="remove">
        {{ t('common.delete') }}
      </BaseButton>
      <BaseButton v-if="readOnly" class="delete-button" @click="beginDuplicate">
        {{ t('customCards.duplicate') }}
      </BaseButton>
      <BaseButton @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton v-if="!readOnly" variant="primary" @click="save">{{ t('common.save') }}</BaseButton>
    </template>
  </BaseDialog>

  <input
    ref="importInput"
    class="visually-hidden"
    type="file"
    accept=".html,.vue-panel-card.html,text/html"
    @change="importFullCode"
  >
</template>

<style scoped>
.dialog-tabs {
  position: sticky;
  top: 0;
  z-index: 4;
  margin-bottom: 18px;
  background: var(--nav-bg);
  box-shadow: 0 10px 14px -16px rgba(0, 0, 0, 0.75);
}
.custom-editor-layout {
  display: grid;
  grid-template-columns: minmax(260px, var(--custom-editor-share, 57%)) 14px minmax(260px, 1fr);
  gap: 10px;
  align-items: start;
}
.editor-pane { min-width: 0; }
.identity-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.metadata-group {
  display: grid;
  gap: 6px;
  padding: 12px;
  border: 1px solid var(--divider);
  border-radius: 10px;
}
.metadata-group > strong {
  margin-bottom: 2px;
  color: var(--text-secondary);
  font-size: 12px;
}
.check-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 34px;
  color: var(--text-primary);
  font-size: 13px;
}
@media (max-width: 620px) {
  .identity-grid { grid-template-columns: 1fr; }
}
.editor-preview-splitter {
  position: sticky;
  top: 62px;
  align-self: stretch;
  min-height: 250px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  cursor: col-resize;
  touch-action: none;
  outline: none;
}
.editor-preview-splitter::before {
  content: '';
  position: absolute;
  inset-block: 0;
  left: 50%;
  width: 1px;
  background: var(--divider);
  transform: translateX(-50%);
  transition: width 140ms ease, background 140ms ease;
}
.editor-preview-splitter > span {
  position: relative;
  z-index: 1;
  width: 6px;
  height: 42px;
  border: 1px solid var(--divider);
  border-radius: 999px;
  background: var(--nav-bg);
  box-shadow: var(--card-shadow);
}
.editor-preview-splitter:hover::before,
.editor-preview-splitter:focus-visible::before,
.custom-editor-layout.is-resizing .editor-preview-splitter::before {
  width: 3px;
  background: var(--accent);
}
.editor-preview-splitter:focus-visible > span { border-color: var(--accent); }
.custom-editor-layout.is-resizing,
.custom-editor-layout.is-resizing * { cursor: col-resize !important; user-select: none !important; }
.settings-form { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.variables-pane { display: flex; flex-direction: column; gap: 14px; }
.variables-intro {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.variables-intro > div { display: grid; gap: 4px; }
.variables-intro strong { color: var(--text-primary); font-size: 13px; }
.variables-intro p { margin: 0; color: var(--text-secondary); font-size: 12px; line-height: 1.45; }
.variables-intro :deep(.vp-btn) { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.translations-pane { display: flex; flex-direction: column; gap: 14px; }
.fallback-field { max-width: 280px; }
.translation-add { display: flex; align-items: center; gap: 8px; }
.translation-add :deep(.vp-btn) { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.translation-missing { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.translation-missing > small { color: var(--text-secondary); font-size: 11px; }
.translation-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  border: 1px dashed var(--divider);
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary);
  padding: 3px 9px 3px 6px;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.translation-chip:hover { border-color: var(--accent); color: var(--text-primary); }
.translation-list { display: flex; flex-direction: column; gap: 10px; }
.translation-languages {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px;
  align-items: start;
}
.language-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.language-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--divider);
  border-radius: 999px;
  padding: 3px 6px 3px 10px;
  color: var(--text-primary);
  font-size: 11px;
}
.language-chip.is-fallback { border-color: color-mix(in srgb, var(--accent) 55%, var(--divider)); }
.translation-row {
  display: grid;
  grid-template-columns: 220px repeat(auto-fit, minmax(180px, 1fr));
  align-items: end;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--divider);
  border-radius: 10px;
}
.translation-row.is-missing { border-color: color-mix(in srgb, var(--danger, #ef4444) 45%, var(--divider)); }
.translation-key { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; }
.translation-key code {
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.translation-remove {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  padding: 2px;
  cursor: pointer;
}
.translation-remove:hover { color: var(--danger, #ef4444); }
@media (max-width: 900px) {
  .translation-row { grid-template-columns: minmax(0, 1fr); }
  .translation-languages { grid-template-columns: minmax(0, 1fr); }
}
.variable-mode-tabs :deep(.vp-tab) { padding: 6px 10px; font-size: 12px; }
.variable-json-pane { display: flex; flex-direction: column; gap: 10px; }
.variable-json-pane > p { margin: 0; color: var(--text-secondary); font-size: 12px; line-height: 1.45; }
.variable-json-error { display: block; line-height: 1.4; }
.variable-list { display: flex; flex-direction: column; gap: 12px; }
.variable-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 13px;
  padding: 14px;
}
.default-field { grid-column: 1 / -1; }
.required-field {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 34px;
}
.required-field > span { color: var(--text-secondary); font-size: 12px; }
.variables-empty {
  min-height: 190px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 6px;
  padding: 24px;
  border: 1px dashed var(--divider);
  border-radius: 12px;
  color: var(--text-secondary);
  text-align: center;
}
.variables-empty strong { color: var(--text-primary); font-size: 13px; }
.variables-empty span { max-width: 360px; font-size: 11px; line-height: 1.45; }
.field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.field > span, .size-heading small { color: var(--text-secondary); font-size: 12px; }
.settings-form > .field:first-child,
.settings-form > .field:nth-child(2),
.size-group { grid-column: 1 / -1; }
.field-error, .source-error { color: var(--danger, #ef4444); font-size: 11px; }
.field-hint { color: var(--text-muted, #94a3b8); font-size: 11px; }
.icon-field { display: flex; gap: 8px; }
.icon-preview {
  display: grid;
  place-items: center;
  width: 40px;
  flex: 0 0 40px;
  border: 1px solid var(--divider);
  border-radius: 9px;
  background: var(--card-bg);
  color: var(--text-primary);
}
.size-group {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  padding-top: 18px;
  border-top: 1px solid var(--divider);
}
.size-heading { grid-column: 1 / -1; display: grid; gap: 3px; }
.size-heading strong { color: var(--text-primary); font-size: 13px; }
.code-pane { display: flex; flex-direction: column; gap: 10px; }
.code-pane > p { margin: 0; color: var(--text-secondary); font-size: 12px; }
.full-code-pane { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.full-code-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.full-code-toolbar > div:first-child { display: grid; gap: 4px; }
.full-code-toolbar strong { color: var(--text-primary); font-size: 13px; }
.full-code-toolbar p { margin: 0; color: var(--text-secondary); font-size: 12px; line-height: 1.45; }
.full-code-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.full-code-actions :deep(.vp-btn) { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.full-code-error { display: block; line-height: 1.4; }
.custom-editor-layout.is-fullscreen { flex: 1; min-height: 0; align-items: stretch; }
.custom-editor-layout.is-fullscreen .editor-pane,
.custom-editor-layout.is-fullscreen .full-code-pane { min-height: 0; height: 100%; }
.custom-editor-layout.is-fullscreen .full-code-editor { flex: 1; min-height: 0; }
.custom-editor-layout.is-fullscreen .full-code-editor :deep(.vp-code-editor),
.custom-editor-layout.is-fullscreen .full-code-editor :deep(.cm-editor) { height: 100%; }
.visually-hidden {
  position: fixed;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.api-reference {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}
.api-reference code {
  overflow: hidden;
  padding: 7px 9px;
  border-radius: 7px;
  background: var(--nav-item-hover);
  color: var(--text-secondary);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.source-error { margin-top: 10px; }
.preview-panel {
  position: sticky;
  top: 62px;
  overflow: hidden;
  border: 1px solid var(--divider);
  border-radius: 14px;
}
.preview-head, .preview-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px;
  background: var(--nav-bg);
  color: var(--text-secondary);
  font-size: 11px;
}
.preview-head { border-bottom: 1px solid var(--divider); letter-spacing: .1em; text-transform: uppercase; }
.preview-foot { border-top: 1px solid var(--divider); }
.preview-badge { display: inline-flex; align-items: center; gap: 4px; color: #44a46f; letter-spacing: 0; text-transform: none; }
.preview-stage {
  min-height: 250px;
  padding: 24px;
  display: grid;
  place-items: center;
  overflow: auto;
  background:
    linear-gradient(45deg, color-mix(in srgb, var(--divider) 30%, transparent) 25%, transparent 25%) 0 0 / 16px 16px,
    linear-gradient(-45deg, color-mix(in srgb, var(--divider) 30%, transparent) 25%, transparent 25%) 0 8px / 16px 16px,
    var(--bg);
}
.preview-card { max-width: 100%; flex: 0 0 auto; }
.delete-button { margin-right: auto; }
@media (max-width: 760px) {
  .custom-editor-layout { grid-template-columns: 1fr; }
  .editor-preview-splitter { display: none; }
  .settings-form, .size-group, .api-reference { grid-template-columns: 1fr; }
  .settings-form > *, .size-heading { grid-column: auto; }
  .preview-panel { position: static; }
  .variable-fields { grid-template-columns: 1fr; }
  .default-field, .required-field { grid-column: auto; }
  .full-code-toolbar { flex-direction: column; }
  .full-code-actions { justify-content: flex-start; }
}
</style>
