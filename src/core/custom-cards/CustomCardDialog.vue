<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type {
  CustomCardDefinition,
  CustomCardVariable,
  CustomCardVariableType,
} from '@/core/config/types'
import { newId, useDashboardStore } from '@/core/config/dashboardStore'
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
import { confirmDialog } from '@/core/ui/dialogService'
import EntityPicker from '@/core/editor/EntityPicker.vue'
import CustomCardSandbox from './CustomCardSandbox.vue'

const props = defineProps<{ definition?: CustomCardDefinition }>()
const emit = defineEmits<{ close: []; saved: [definition: CustomCardDefinition] }>()
const { t } = useI18n()
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

const DEFAULT_JAVASCRIPT = `// The sandbox exposes a controlled Home Assistant API as "vuePanel".
// Read instance variables with vuePanel.config, for example:
// const entityId = vuePanel.config.entity;
// const entity = await vuePanel.getEntity('sensor.example');
// await vuePanel.callService('light', 'toggle', {}, { entity_id: 'light.example' });`

interface FullCodeMetadata {
  format: 'vue-panel-custom-card'
  version: 1
  name: string
  description: string
  icon: string
  defaultSize: CustomCardDefinition['defaultSize']
  variables: Array<Omit<CustomCardVariable, 'id'>>
}

function freshDefinition(): CustomCardDefinition {
  return {
    id: newId('custom'),
    name: '',
    description: '',
    icon: 'mdi:code-tags',
    html: DEFAULT_HTML,
    css: DEFAULT_CSS,
    javascript: DEFAULT_JAVASCRIPT,
    variables: [],
    defaultSize: { cols: 1, rows: 1, width: 140, height: 120 },
  }
}

function initialDefinition(): CustomCardDefinition {
  const definition = JSON.parse(
    JSON.stringify(props.definition ?? freshDefinition()),
  ) as CustomCardDefinition
  definition.variables ??= []
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

const editorLayoutStyle = computed(() => ({
  '--custom-editor-share': `${editorShare.value}%`,
}))

const tabs = computed<TabItem[]>(() => [
  { value: 'settings', label: t('editor.tabSettings'), icon: 'mdi:tune' },
  { value: 'variables', label: t('customCards.variables.tab'), icon: 'mdi:variable' },
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
])

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
  variable.default = type === 'boolean' ? false : type === 'number' ? 0 : type === 'icon' ? 'mdi:star' : ''
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

  const allowedTypes: CustomCardVariableType[] = ['entity', 'string', 'number', 'boolean', 'icon']
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
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) || keys.has(key) || key === 'definitionId') {
      throw new Error(t('customCards.variables.jsonKeyError', { index: index + 1 }))
    }
    if (!label || !allowedTypes.includes(type)) {
      throw new Error(t('customCards.variables.jsonEntryError', { index: index + 1 }))
    }
    const rawDefault = value.default
    const defaultValue: string | number | boolean = rawDefault === undefined || rawDefault === null
      ? defaultVariableValue(type)
      : rawDefault as string | number | boolean
    if ((type === 'number' && typeof defaultValue !== 'number')
      || (type === 'boolean' && typeof defaultValue !== 'boolean')
      || (!['number', 'boolean'].includes(type) && typeof defaultValue !== 'string')) {
      throw new Error(t('customCards.variables.jsonDefaultError', { index: index + 1 }))
    }
    keys.add(key)
    return {
      id: existingIds.get(key) ?? newId('variable'),
      key,
      label,
      type,
      required: value.required === true,
      domain: type === 'entity' && typeof value.domain === 'string' ? value.domain : undefined,
      default: defaultValue,
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
    format: 'vue-panel-custom-card',
    version: 1,
    name: draft.value.name,
    description: draft.value.description,
    icon: draft.value.icon,
    defaultSize: { ...draft.value.defaultSize },
    variables: portableVariables(),
  }
}

function serializeFullCode(): string {
  const metadata = JSON.stringify(fullCodeMetadata(), null, 2)
    .replace(/<\/script/gi, '<\\/script')
  const scriptEnd = '<' + '/script>'
  return `<script data-vue-panel-config>
const vuePanelCard = ${metadata};
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

function definitionFromFullCode(
  parsed: unknown,
  html: unknown,
  css: unknown,
  javascript: unknown,
): CustomCardDefinition {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(t('customCards.fullCode.documentError'))
  }
  const value = parsed as Record<string, unknown>
  if (value.format !== 'vue-panel-custom-card' || value.version !== 1) {
    throw new Error(t('customCards.fullCode.formatError'))
  }
  if (typeof value.name !== 'string'
    || typeof value.description !== 'string'
    || typeof value.icon !== 'string'
    || typeof html !== 'string'
    || typeof css !== 'string'
    || typeof javascript !== 'string'
    || !Array.isArray(value.variables)
    || !value.defaultSize
    || typeof value.defaultSize !== 'object'
    || Array.isArray(value.defaultSize)) {
    throw new Error(t('customCards.fullCode.documentError'))
  }
  const size = value.defaultSize as Record<string, unknown>
  const variables = parseVariablesJson(JSON.stringify(value.variables))
  return {
    id: draft.value.id,
    name: value.name,
    description: value.description,
    icon: value.icon,
    defaultSize: {
      cols: positiveInteger(Number(size.cols), 1),
      rows: positiveInteger(Number(size.rows), 1),
      width: positiveInteger(Number(size.width), 140),
      height: positiveInteger(Number(size.height), 120),
    },
    variables,
    html,
    css,
    javascript,
  }
}

function sectionContent(source: string, pattern: RegExp): string {
  const match = source.match(pattern)
  if (!match || match[1] === undefined) throw new Error(t('customCards.fullCode.documentError'))
  return match[1].replace(/^\r?\n/, '').replace(/\r?\n$/, '')
}

function parseJavaScriptMetadata(source: string): unknown {
  const declaration = /^\s*const\s+vuePanelCard\s*=\s*/
  if (!declaration.test(source)) throw new Error(t('customCards.fullCode.documentError'))
  let json = source.replace(declaration, '').trim()
  if (json.endsWith(';')) json = json.slice(0, -1).trim()
  return JSON.parse(json)
}

function parseFullCode(source: string): CustomCardDefinition {
  const trimmed = source.trimStart()
  if (trimmed.startsWith('{')) {
    const legacy: unknown = JSON.parse(source)
    if (!legacy || typeof legacy !== 'object' || Array.isArray(legacy)) {
      throw new Error(t('customCards.fullCode.documentError'))
    }
    const value = legacy as Record<string, unknown>
    return definitionFromFullCode(legacy, value.html, value.css, value.javascript)
  }

  const currentMetadata = source.match(
    /<script\s+data-vue-panel-config>([\s\S]*?)<\/script>/i,
  )
  const legacyMetadata = source.match(
    /<script\s+type="application\/json"\s+data-vue-panel-config>([\s\S]*?)<\/script>/i,
  )
  const metadata = currentMetadata?.[1] !== undefined
    ? parseJavaScriptMetadata(currentMetadata[1])
    : legacyMetadata?.[1] !== undefined
      ? JSON.parse(legacyMetadata[1])
      : undefined
  if (!metadata) throw new Error(t('customCards.fullCode.documentError'))
  const html = sectionContent(source, /<template\s+data-vue-panel-html>([\s\S]*?)<\/template>/i)
  const css = sectionContent(source, /<style\s+data-vue-panel-css>([\s\S]*?)<\/style>/i)
  const javascript = sectionContent(
    source,
    /<script\s+data-vue-panel-javascript>([\s\S]*?)<\/script>/i,
  )
  return definitionFromFullCode(metadata, html, css, javascript)
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
  if (['definitionId', '__proto__', 'prototype', 'constructor'].includes(variable.key)) return true
  return draft.value.variables.some(
    (candidate) => candidate.id !== variable.id && candidate.key === variable.key,
  )
}

const variablesInvalid = computed(() => draft.value.variables.some(
  (variable) => variableKeyInvalid(variable) || !variable.label.trim(),
) || Boolean(variableJsonError.value))

const previewConfig = computed<Record<string, unknown>>(() => Object.fromEntries([
  ['definitionId', draft.value.id],
  ...draft.value.variables.map((variable) => [variable.key, variable.default]),
]))

const duplicateName = computed(() => {
  const name = draft.value.name.trim().toLocaleLowerCase()
  return name !== '' && store.customCards.some(
    (definition) => definition.id !== draft.value.id
      && definition.name.trim().toLocaleLowerCase() === name,
  )
})
const nameInvalid = computed(() => validationAttempted.value && !draft.value.name.trim() || duplicateName.value)

function sourceBytes(definition: CustomCardDefinition): number {
  return new TextEncoder().encode(
    definition.html + definition.css + definition.javascript,
  ).byteLength
}

const definitionTooLarge = computed(() => sourceBytes(draft.value) > 256 * 1024)
const collectionTooLarge = computed(() => {
  const others = store.customCards
    .filter((definition) => definition.id !== draft.value.id)
    .reduce((total, definition) => total + sourceBytes(definition), 0)
  return others + sourceBytes(draft.value) > 4 * 1024 * 1024
})
const sourceSize = computed(() => `${(sourceBytes(draft.value) / 1024).toFixed(1)} KB`)

function positiveInteger(value: number | string, fallback: number): number {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.round(number) : fallback
}

function save() {
  validationAttempted.value = true
  if (nameInvalid.value || variablesInvalid.value || fullCodeError.value || definitionTooLarge.value || collectionTooLarge.value) return
  draft.value.name = draft.value.name.trim()
  draft.value.icon = draft.value.icon.trim() || 'mdi:code-tags'
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
  store.upsertCustomCard(draft.value)
  emit('saved', draft.value)
  emit('close')
}

async function remove() {
  if (!props.definition) return
  if (!(await confirmDialog(t('customCards.deleteConfirm', { name: props.definition.name })))) return
  store.removeCustomCard(props.definition.id)
  emit('close')
}

const previewStyle = computed(() => ({
  width: `${positiveInteger(draft.value.defaultSize.width, 140)}px`,
  height: `${positiveInteger(draft.value.defaultSize.height, 120)}px`,
}))
</script>

<template>
  <BaseDialog
    :title="definition ? t('customCards.editTitle', { name: definition.name }) : t('customCards.newTitle')"
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
          <label class="field">
            <span>{{ t('customCards.fields.name') }} *</span>
            <BaseInput v-model="draft.name" :invalid="nameInvalid" />
            <small v-if="duplicateName" class="field-error">{{ t('customCards.errors.duplicateName') }}</small>
            <small v-else-if="validationAttempted && !draft.name.trim()" class="field-error">
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
                  <div class="field default-field">
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

        <div v-if="definitionTooLarge || collectionTooLarge" class="source-error">
          {{ definitionTooLarge ? t('customCards.errors.cardTooLarge') : t('customCards.errors.collectionTooLarge') }}
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
          <span class="sandbox-badge"><MdiIcon icon="mdi:shield-check-outline" :size="13" /> Sandbox</span>
        </div>
        <div class="preview-stage">
          <div class="preview-card" :style="previewStyle">
            <CustomCardSandbox :definition="draft" :config="previewConfig" preview />
          </div>
        </div>
        <div class="preview-foot">
          <span>{{ draft.defaultSize.width }} x {{ draft.defaultSize.height }} px</span>
          <span>{{ sourceSize }}</span>
        </div>
      </aside>
    </div>

    <template #footer>
      <BaseButton v-if="definition" variant="danger" class="delete-button" @click="remove">
        {{ t('common.delete') }}
      </BaseButton>
      <BaseButton @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton variant="primary" @click="save">{{ t('common.save') }}</BaseButton>
    </template>
  </BaseDialog>

  <input
    ref="importInput"
    class="visually-hidden"
    type="file"
    accept=".html,.vue-panel-card.html,.json,.vue-panel-card.json,text/html,application/json"
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
.sandbox-badge { display: inline-flex; align-items: center; gap: 4px; color: #44a46f; letter-spacing: 0; text-transform: none; }
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
