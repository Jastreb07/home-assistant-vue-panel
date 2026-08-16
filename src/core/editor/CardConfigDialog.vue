<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { cardRegistry, resolveCardComponent } from '@/core/registry/cardRegistry'
import BaseDialog from '@/core/ui/BaseDialog.vue'
import BaseButton from '@/core/ui/BaseButton.vue'
import SchemaForm from './SchemaForm.vue'

const props = defineProps<{
  /** CardManifest.type */
  cardType: string
  initialConfig: Record<string, unknown>
}>()
const emit = defineEmits<{ close: []; save: [config: Record<string, unknown>] }>()

const { t } = useI18n()
const manifest = cardRegistry[props.cardType]
const previewComponent = resolveCardComponent(props.cardType)

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
</script>

<template>
  <BaseDialog
    :title="t('editor.configureTitle', { name: manifest ? t(manifest.name) : cardType })"
    wide
    @close="emit('close')"
  >
    <div class="config-layout">
      <div class="form-col">
        <SchemaForm v-if="manifest?.schema" v-model="draft" :schema="manifest.schema" />
        <p v-else class="no-options">{{ t('editor.noOptions') }}</p>
      </div>
      <div class="preview-col">
        <span class="preview-label">{{ t('common.preview') }}</span>
        <component :is="previewComponent" v-if="previewComponent" :config="draft" />
      </div>
    </div>
    <template #footer>
      <BaseButton @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton variant="primary" @click="emit('save', draft)">{{ t('common.save') }}</BaseButton>
    </template>
  </BaseDialog>
</template>

<style scoped>
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
