<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  cardRegistry,
  cardDefaultCss,
  resolveCardComponent,
  resolveCardEditor,
  type CardCssArea,
} from '@/core/registry/cardRegistry'
import BaseDialog from '@/core/ui/BaseDialog.vue'
import BaseButton from '@/core/ui/BaseButton.vue'
import CardCss from '@/core/ui/CardCss.vue'
import BaseCodeEditor from '@/core/ui/BaseCodeEditor.vue'
import BaseTabs from '@/core/ui/BaseTabs.vue'
import BaseInput from '@/core/ui/BaseInput.vue'
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

const { t } = useI18n()
const manifest = cardRegistry[props.cardType]
const previewComponent = resolveCardComponent(props.cardType)
const editorComponent = resolveCardEditor(props.cardType)

function applyDefaults(config: Record<string, unknown>): Record<string, unknown> {
  const result = { ...config }
  for (const [key, field] of Object.entries(manifest?.schema ?? {})) {
    if (result[key] === undefined && field.default !== undefined) {
      result[key] = field.default
    }
  }
  return result
}

const draft = ref<Record<string, unknown>>(applyDefaults(props.initialConfig))

// ── CSS tab ──────────────────────────────────────────────────
const tab = ref('settings')
const tabItems = computed(() => [
  { value: 'settings', label: t('editor.tabSettings'), icon: 'mdi:tune' },
  ...(props.sizable
    ? [{ value: 'size', label: t('editor.tabSize'), icon: 'mdi:resize' }]
    : []),
  { value: 'css', label: t('editor.tabCss'), icon: 'mdi:language-css3' },
])

// ── Size tab (flex layout) ───────────────────────────────────
// Empty means "not set": the layout falls back to its own default.
const cardWidth = ref<number | ''>(props.initialSize?.width ?? '')
const cardHeight = ref<number | ''>(props.initialSize?.height ?? '')

// Keep the fields in sync when the card is resized by dragging
watch(
  () => props.initialSize,
  (size) => {
    cardWidth.value = size?.width ?? ''
    cardHeight.value = size?.height ?? ''
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

onMounted(async () => {
  defaultCss.value = await cardDefaultCss(props.cardType, props.area)
  if (!props.initialCss) cssDraft.value = defaultCss.value
})

function onSave() {
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
}

/** The preview mirrors the fixed size so typed values are visible right away. */
const previewStyle = computed(() => {
  if (!props.sizable) return undefined
  const style: Record<string, string> = { maxWidth: 'none' }
  // 220px is the flex layout's fallback width for cards without a size
  style.width = `${sizeValue(cardWidth.value) ?? 220}px`
  const height = sizeValue(cardHeight.value)
  if (height) style.height = `${height}px`
  return style
})

/** Bar areas sit on the nav background, not the dashboard background. */
const isBarArea = computed(() => props.area !== 'default')
</script>

<template>
  <BaseDialog
    :title="t('editor.configureTitle', { name: manifest ? t(manifest.name) : cardType })"
    size="xl"
    @close="emit('close')"
  >
    <BaseTabs v-model="tab" :items="tabItems" class="dialog-tabs" />

    <div class="config-layout">
      <div v-show="tab === 'settings'" class="form-col">
        <component :is="editorComponent" v-if="editorComponent" v-model="draft" />
        <SchemaForm v-if="manifest?.schema" v-model="draft" :schema="manifest.schema" />
        <p v-if="!manifest?.schema && !editorComponent" class="no-options">
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
      <div v-show="tab === 'css'" class="form-col css-col">
        <p class="css-hint">{{ t('editor.cssHint') }}</p>
        <BaseCodeEditor v-model="cssDraft" language="css" min-height="300px" />
        <div class="css-actions">
          <BaseButton size="sm" @click="resetCss">{{ t('editor.cssReset') }}</BaseButton>
        </div>
      </div>
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
  margin-bottom: 18px;
}
.config-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 45%);
  gap: 24px;
  align-items: start;
}
@media (max-width: 720px) {
  .config-layout {
    grid-template-columns: 1fr;
  }
}
.form-col {
  display: flex;
  flex-direction: column;
  gap: 20px;
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
/* Set apart from the form: own panel with the background of the target area */
.preview-col {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--divider);
  border-radius: 14px;
  overflow: hidden;
}
.preview-head {
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
  min-height: 160px;
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
</style>
