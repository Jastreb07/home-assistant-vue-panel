<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  cardRegistry,
  cardDefaultCss,
  resolveCardComponent,
  resolveCardEditor,
} from '@/core/registry/cardRegistry'
import BaseDialog from '@/core/ui/BaseDialog.vue'
import BaseButton from '@/core/ui/BaseButton.vue'
import CardCss from '@/core/ui/CardCss.vue'
import SchemaForm from './SchemaForm.vue'

const props = defineProps<{
  /** CardManifest.type */
  cardType: string
  initialConfig: Record<string, unknown>
  /** Saved per-card CSS override, if any */
  initialCss?: string
}>()
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
  defaultCss.value = await cardDefaultCss(props.cardType)
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
</script>

<template>
  <BaseDialog
    :title="t('editor.configureTitle', { name: manifest ? t(manifest.name) : cardType })"
    wide
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
      <div class="preview-col">
        <span class="preview-label">{{ t('common.preview') }}</span>
        <CardCss card-id="__preview__" :css="cssDraft.trim() !== defaultCss.trim() ? cssDraft : ''">
          <div data-vp-card="__preview__">
            <component :is="previewComponent" v-if="previewComponent" :config="draft" />
          </div>
        </CardCss>
      </div>
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
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}
@media (max-width: 560px) {
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
.preview-col {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.preview-label {
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-secondary);
}
.no-options {
  color: var(--text-secondary);
}
</style>
