<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  cardRegistry,
  cardDefaultCss,
  cardDisplayName,
  resolveCardComponent,
  type CardSchemaField,
  type CardCssArea,
} from '@/core/registry/cardRegistry'
import BaseDialog from '@/core/ui/BaseDialog.vue'
import BaseButton from '@/core/ui/BaseButton.vue'
import CardCss from '@/core/ui/CardCss.vue'
import BaseCodeEditor from '@/core/ui/BaseCodeEditor.vue'
import BaseTabs from '@/core/ui/BaseTabs.vue'
import BaseInput from '@/core/ui/BaseInput.vue'
import BaseCheckbox from '@/core/ui/BaseCheckbox.vue'
import BaseCollapsible from '@/core/ui/BaseCollapsible.vue'
import BaseSplitter from '@/core/ui/BaseSplitter.vue'
import {
  defaultResponsiveVisibility,
  responsiveVisibilityFromCss,
  withResponsiveCss,
} from '@/core/ui/responsiveCss'
import SchemaForm from './SchemaForm.vue'

const props = withDefaults(
  defineProps<{
    /** CardManifest.type */
    cardType: string
    initialConfig: Record<string, unknown>
    /** Saved per-card CSS override, if any */
    initialCss?: string
    /** Where the card sits — decides which default CSS is loaded */
    area?: CardCssArea
    /** Offer the size tab — only layouts with fixed px sizes (flex) do */
    sizable?: boolean
    /** Current px size of the card, for the size tab */
    initialSize?: { width?: number; height?: number }
  }>(),
  { area: 'default' },
)
const emit = defineEmits<{
  close: []
  save: [config: Record<string, unknown>, css?: string, size?: { width?: number; height?: number }]
}>()

const { t, locale } = useI18n()
const manifest = cardRegistry[props.cardType]
const previewComponent = resolveCardComponent(props.cardType)

const effectiveDefaultSize = computed(() => manifest?.defaultSize)

const effectiveSchema = computed<Record<string, CardSchemaField>>(() => {
  return manifest?.schema ?? {}
})

const hasSchema = computed(() => Object.keys(effectiveSchema.value).length > 0)
const dialogName = computed(() =>
  manifest ? cardDisplayName(manifest, t, locale.value) : props.cardType,
)

function applyDefaults(config: Record<string, unknown>): Record<string, unknown> {
  const result = { ...config }
  for (const [key, field] of Object.entries(effectiveSchema.value)) {
    if (result[key] === undefined && field.default !== undefined) {
      result[key] = field.default
    }
  }
  return result
}

const draft = ref<Record<string, unknown>>(applyDefaults(props.initialConfig))
const saveAttempted = ref(false)
const missingRequiredVariables = computed(() => Object.entries(effectiveSchema.value).some(
  ([key, field]) => field.required
    && (draft.value[key] === undefined || draft.value[key] === null || draft.value[key] === ''),
))

// ── CSS tab ──────────────────────────────────────────────────
const tab = ref('settings')
const tabItems = computed(() => [
  { value: 'settings', label: t('editor.tabSettings'), icon: 'mdi:tune' },
  ...(props.sizable
    ? [{ value: 'size', label: t('editor.tabSize'), icon: 'mdi:resize' }]
    : []),
  { value: 'visibility', label: t('editor.tabVisibility'), icon: 'mdi:eye-outline' },
  { value: 'css', label: t('editor.tabCss'), icon: 'mdi:language-css3' },
])

// ── Size tab (flex layout) ───────────────────────────────────
// Empty means "not set": the layout falls back to its own default.
const cardWidth = ref<number | ''>(props.initialSize?.width ?? effectiveDefaultSize.value?.width ?? '')
const cardHeight = ref<number | ''>(props.initialSize?.height ?? effectiveDefaultSize.value?.height ?? '')

// Keep the fields in sync when the card is resized by dragging
watch(
  () => props.initialSize,
  (size) => {
    cardWidth.value = size?.width ?? effectiveDefaultSize.value?.width ?? ''
    cardHeight.value = size?.height ?? effectiveDefaultSize.value?.height ?? ''
  },
  { deep: true },
)

function sizeValue(raw: number | ''): number | undefined {
  const n = Number(raw)
  return raw === '' || !Number.isFinite(n) || n <= 0 ? undefined : Math.round(n)
}
const defaultCss = ref('')
// Pre-filled with the card's full default CSS so users can tweak it
const cssDraft = ref(props.initialCss ?? '')
const visibility = ref({ ...defaultResponsiveVisibility })
const mobileBreakpointDraft = ref<string | number>(defaultResponsiveVisibility.mobileMax)
const tabletBreakpointDraft = ref<string | number>(defaultResponsiveVisibility.tabletMax)
const responsiveReady = ref(false)

function readResponsiveCss() {
  visibility.value = responsiveVisibilityFromCss(cssDraft.value)
  mobileBreakpointDraft.value = visibility.value.mobileMax
  tabletBreakpointDraft.value = visibility.value.tabletMax
}

function commitMobileBreakpoint() {
  const raw = mobileBreakpointDraft.value
  const parsed = raw === '' ? Number.NaN : Number(raw)
  const value = Number.isFinite(parsed)
    ? Math.min(Math.max(Math.round(parsed), 320), 2000)
    : visibility.value.mobileMax
  visibility.value.mobileMax = value
  mobileBreakpointDraft.value = value
  if (visibility.value.tabletMax <= value) {
    visibility.value.tabletMax = value + 1
    tabletBreakpointDraft.value = value + 1
  }
}

function commitTabletBreakpoint() {
  const raw = tabletBreakpointDraft.value
  const parsed = raw === '' ? Number.NaN : Number(raw)
  const value = Number.isFinite(parsed)
    ? Math.min(Math.max(Math.round(parsed), visibility.value.mobileMax + 1), 4000)
    : visibility.value.tabletMax
  visibility.value.tabletMax = value
  tabletBreakpointDraft.value = value
}

onMounted(async () => {
  defaultCss.value = await cardDefaultCss(props.cardType, props.area)
  if (!props.initialCss) cssDraft.value = defaultCss.value
  readResponsiveCss()
  responsiveReady.value = true
})

watch(visibility, (value) => {
  if (responsiveReady.value) cssDraft.value = withResponsiveCss(cssDraft.value, value)
}, { deep: true })

watch(tab, (value) => {
  if (value === 'visibility' && responsiveReady.value) readResponsiveCss()
})

function onSave() {
  saveAttempted.value = true
  if (missingRequiredVariables.value) return
  // Only store an override when it actually differs from the card default
  const css = cssDraft.value.trim()
  const isOverride = css !== '' && css !== defaultCss.value.trim()
  const size = props.sizable
    ? { width: sizeValue(cardWidth.value), height: sizeValue(cardHeight.value) }
    : undefined
  emit('save', draft.value, isOverride ? cssDraft.value : undefined, size)
}

function resetCss() {
  cssDraft.value = defaultCss.value
  readResponsiveCss()
}

/** The preview mirrors the fixed size so typed values are visible right away. */
const previewStyle = computed(() => {
  if (!props.sizable) return undefined
  const style: Record<string, string> = { maxWidth: 'none' }
  const defaultSize = effectiveDefaultSize.value
  style.width = `${sizeValue(cardWidth.value) ?? defaultSize?.width ?? 140}px`
  const height = sizeValue(cardHeight.value) ?? defaultSize?.height
  if (height) style.height = `${height}px`
  return style
})

// ── Resizable preview ────────────────────────────────────────
const formShare = ref(55)
const splitterDragging = ref(false)
const layoutStyle = computed(() => ({ '--config-form-share': `${formShare.value}%` }))

/** Bar areas sit on the nav background, not the dashboard background. */
const isBarArea = computed(() => props.area !== 'default')
</script>

<template>
  <BaseDialog
    :title="t('editor.configureTitle', { name: dialogName })"
    size="xl"
    @close="emit('close')"
  >
    <BaseTabs v-model="tab" :items="tabItems" class="dialog-tabs" />

    <div
      class="config-layout"
      :class="{ 'is-resizing': splitterDragging }"
      :style="layoutStyle"
    >
      <div v-show="tab === 'settings'" class="form-col">
        <SchemaForm
          v-if="hasSchema"
          v-model="draft"
          :schema="effectiveSchema"
          :translations="manifest?.translations"
        />
        <p v-if="saveAttempted && missingRequiredVariables" class="validation-error">
          {{ t('customCards.variables.requiredError') }}
        </p>
        <p v-if="!hasSchema" class="no-options">
          {{ t('editor.noOptions') }}
        </p>
      </div>
      <div v-show="tab === 'size'" class="form-col">
        <p class="css-hint">{{ t('editor.size.hint') }}</p>
        <div class="field">
          <span>{{ t('editor.size.width') }}</span>
          <BaseInput
            :model-value="cardWidth"
            type="number"
            :min="40"
            :max="4000"
            @update:model-value="cardWidth = Number($event) || ''"
          />
        </div>
        <div class="field">
          <span>{{ t('editor.size.height') }}</span>
          <BaseInput
            :model-value="cardHeight"
            type="number"
            :min="40"
            :max="4000"
            @update:model-value="cardHeight = Number($event) || ''"
          />
        </div>
      </div>
      <div v-show="tab === 'visibility'" class="form-col">
        <BaseCollapsible
          :title="t('editor.visibility.responsiveDesign')"
          icon="mdi:responsive"
          default-open
        >
          <p class="visibility-hint">{{ t('editor.visibility.hint') }}</p>
          <div class="device-list">
            <div class="device-row">
              <div class="device-label">
                <span>{{ t('editor.visibility.mobile') }}</span>
                <small>{{ t('editor.visibility.mobileRange', { max: visibility.mobileMax }) }}</small>
              </div>
              <BaseCheckbox v-model="visibility.mobile" />
            </div>
            <div class="device-row">
              <div class="device-label">
                <span>{{ t('editor.visibility.tablet') }}</span>
                <small>{{ t('editor.visibility.tabletRange', { min: visibility.mobileMax + 1, max: visibility.tabletMax }) }}</small>
              </div>
              <BaseCheckbox v-model="visibility.tablet" />
            </div>
            <div class="device-row">
              <div class="device-label">
                <span>{{ t('editor.visibility.desktop') }}</span>
                <small>{{ t('editor.visibility.desktopRange', { min: visibility.tabletMax + 1 }) }}</small>
              </div>
              <BaseCheckbox v-model="visibility.desktop" />
            </div>
          </div>
          <div class="breakpoint-grid">
            <div class="field">
              <span>{{ t('editor.visibility.mobileBreakpoint') }}</span>
              <BaseInput
                :model-value="mobileBreakpointDraft"
                type="number"
                :min="320"
                :max="2000"
                :step="1"
                @update:model-value="mobileBreakpointDraft = $event"
                @blur="commitMobileBreakpoint"
              />
            </div>
            <div class="field">
              <span>{{ t('editor.visibility.tabletBreakpoint') }}</span>
              <BaseInput
                :model-value="tabletBreakpointDraft"
                type="number"
                :min="visibility.mobileMax + 1"
                :max="4000"
                :step="1"
                @update:model-value="tabletBreakpointDraft = $event"
                @blur="commitTabletBreakpoint"
              />
            </div>
          </div>
          <small class="css-write-hint">{{ t('editor.visibility.cssHint') }}</small>
        </BaseCollapsible>
      </div>
      <div v-show="tab === 'css'" class="form-col css-col">
        <p class="css-hint">{{ t('editor.cssHint') }}</p>
        <BaseCodeEditor v-model="cssDraft" language="css" min-height="300px" />
        <div class="css-actions">
          <BaseButton size="sm" @click="resetCss">{{ t('editor.cssReset') }}</BaseButton>
        </div>
      </div>
      <BaseSplitter
        v-model:share="formShare"
        :label="t('customCards.resizePreview')"
        @update:dragging="splitterDragging = $event"
      />

      <aside class="preview-col">
        <div class="preview-head">
          <span class="preview-label">{{ t('common.preview') }}</span>
          <span class="preview-area">{{ t('editor.cssAreas.' + area) }}</span>
        </div>
        <!-- Always applied: this is exactly what the area renders with -->
        <div class="preview-stage" :class="{ 'on-bar': isBarArea }">
          <CardCss card-id="__preview__" :css="cssDraft">
            <div data-vp-card="__preview__" class="preview-card" :style="previewStyle">
              <component :is="previewComponent" v-if="previewComponent" :config="draft" />
            </div>
          </CardCss>
        </div>
      </aside>
    </div>
    <template #footer>
      <BaseButton @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton variant="primary" @click="onSave">{{ t('common.save') }}</BaseButton>
    </template>
  </BaseDialog>
</template>

<style scoped>
.dialog-tabs {
  /* Spans the padding of the dialog body so nothing scrolls through */
  position: sticky;
  top: calc(var(--vp-dialog-padding, 20px) * -1);
  z-index: 4;
  margin: calc(var(--vp-dialog-padding, 20px) * -1) calc(var(--vp-dialog-padding, 20px) * -1) 18px;
  padding: var(--vp-dialog-padding, 20px) var(--vp-dialog-padding, 20px) 0;
  background: var(--nav-bg);
  box-shadow: 0 10px 14px -16px rgba(0, 0, 0, 0.75);
}
.config-layout {
  display: grid;
  grid-template-columns: minmax(260px, var(--config-form-share, 55%)) 14px minmax(260px, 1fr);
  gap: 10px;
  /* Fills the dialog so the preview stays as tall as the form */
  flex: 1;
  min-height: 0;
  align-items: stretch;
}
.config-layout.is-resizing,
.config-layout.is-resizing * {
  cursor: col-resize !important;
  user-select: none !important;
}
@media (max-width: 720px) {
  .config-layout {
    grid-template-columns: 1fr;
    overflow-y: auto;
  }

  .config-layout :deep(.vp-splitter) {
    display: none;
  }

  .form-col {
    overflow: visible;
  }

  .preview-col {
    min-height: 220px;
  }
}
.form-col {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 0;
  overflow-y: auto;
  scrollbar-gutter: stable;
  padding-right: 4px;
}
.css-col {
  gap: 10px;
}
.css-hint {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field > span {
  font-size: 13px;
  color: var(--text-secondary);
}
.css-actions {
  display: flex;
  justify-content: flex-end;
}
.visibility-hint {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
}
.device-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.device-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 48px;
  padding: 8px 0;
  border-bottom: 1px solid var(--divider);
}
.device-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.device-label > span {
  color: var(--text-primary);
  font-size: 13px;
}
.device-label > small,
.css-write-hint {
  color: var(--text-secondary);
  font-size: 11px;
}
.breakpoint-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 4px;
}
@media (max-width: 560px) {
  .breakpoint-grid {
    grid-template-columns: 1fr;
  }
}
/* Set apart from the form: own panel with the background of the target area */
.preview-col {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid var(--divider);
  border-radius: 14px;
  overflow: hidden;
}
.preview-head {
  flex: none;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  background: var(--nav-bg);
  border-bottom: 1px solid var(--divider);
}
.preview-label {
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-secondary);
}
.preview-area {
  font-size: 11px;
  color: var(--accent);
}
.preview-stage {
  padding: 20px;
  background: var(--bg);
  flex: 1;
  min-height: 0;
  display: grid;
  place-items: center;
  /* A card wider than the panel stays reachable instead of being clipped */
  overflow: auto;
}
/* Cards in a bar sit on the nav background — mirror that here */
.preview-stage.on-bar {
  background: var(--nav-bg);
}
.preview-card {
  width: 100%;
  max-width: 260px;
}
.no-options {
  color: var(--text-secondary);
}
.validation-error {
  margin: 0;
  color: var(--danger, #ef4444);
  font-size: 12px;
}
</style>
