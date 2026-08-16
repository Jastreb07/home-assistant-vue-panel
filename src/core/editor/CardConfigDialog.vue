<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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
  }>(),
  { area: 'default' },
)
const emit = defineEmits<{ close: []; save: [config: Record<string, unknown>, css?: string] }>()

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
const tab = ref<'settings' | 'css'>('settings')
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
  emit('save', draft.value, isOverride ? cssDraft.value : undefined)
}

function resetCss() {
  cssDraft.value = defaultCss.value
}

/** Bar areas sit on the nav background, not the dashboard background. */
const isBarArea = computed(() => props.area !== 'default')
</script>

<template>
  <BaseDialog
    :title="t('editor.configureTitle', { name: manifest ? t(manifest.name) : cardType })"
    size="xl"
    @close="emit('close')"
  >
    <div class="tabs">
      <button class="tab" :class="{ active: tab === 'settings' }" @click="tab = 'settings'">
        {{ t('editor.tabSettings') }}
      </button>
      <button class="tab" :class="{ active: tab === 'css' }" @click="tab = 'css'">
        {{ t('editor.tabCss') }}
      </button>
    </div>

    <div class="config-layout">
      <div v-show="tab === 'settings'" class="form-col">
        <component :is="editorComponent" v-if="editorComponent" v-model="draft" />
        <SchemaForm v-if="manifest?.schema" v-model="draft" :schema="manifest.schema" />
        <p v-if="!manifest?.schema && !editorComponent" class="no-options">
          {{ t('editor.noOptions') }}
        </p>
      </div>
      <div v-show="tab === 'css'" class="form-col css-col">
        <p class="css-hint">{{ t('editor.cssHint') }}</p>
        <textarea
          v-model="cssDraft"
          class="css-editor"
          spellcheck="false"
          :placeholder="t('editor.cssPlaceholder')"
        />
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
            <div data-vp-card="__preview__" class="preview-card">
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
.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 18px;
  border-bottom: 1px solid var(--divider);
}
.tab {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  font-size: 14px;
  padding: 8px 14px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
.tab.active {
  color: var(--text-primary);
  border-bottom-color: var(--accent);
}
.config-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
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
.css-editor {
  width: 100%;
  min-height: 260px;
  resize: vertical;
  background: var(--card-bg);
  border: 1px solid var(--divider);
  border-radius: 10px;
  color: var(--text-primary);
  padding: 10px 12px;
  font-family: 'Cascadia Code', Consolas, 'Fira Code', monospace;
  font-size: 12.5px;
  line-height: 1.5;
  outline: none;
  tab-size: 2;
}
.css-editor:focus {
  border-color: var(--accent);
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
