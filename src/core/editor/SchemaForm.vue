<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { CardSchemaField } from '@/core/registry/cardRegistry'
import { useDashboardStore } from '@/core/config/dashboardStore'
import EntityPicker from './EntityPicker.vue'

const props = defineProps<{
  schema: Record<string, CardSchemaField>
  modelValue: Record<string, unknown>
}>()
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, unknown>] }>()

const { t } = useI18n()
const store = useDashboardStore()

function set(key: string, value: unknown) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

function str(key: string): string {
  return (props.modelValue[key] as string | undefined) ?? ''
}

function bool(key: string, field: CardSchemaField): boolean {
  const v = props.modelValue[key]
  return v === undefined ? field.default === true : v === true
}
</script>

<template>
  <div class="schema-form">
    <label v-for="(field, key) in schema" :key="key" class="field" :class="'type-' + field.type">
      <span class="label">
        {{ t(field.label) }}<span v-if="!field.optional && field.type === 'entity'"> *</span>
      </span>

      <EntityPicker
        v-if="field.type === 'entity'"
        :model-value="str(key)"
        :domain="field.domain"
        @update:model-value="set(key, $event)"
      />

      <input
        v-else-if="field.type === 'string'"
        :value="str(key)"
        type="text"
        @input="set(key, ($event.target as HTMLInputElement).value)"
      />

      <input
        v-else-if="field.type === 'number'"
        :value="(modelValue[key] as number | undefined) ?? (field.default as number | undefined) ?? 0"
        type="number"
        @input="set(key, Number(($event.target as HTMLInputElement).value))"
      />

      <input
        v-else-if="field.type === 'boolean'"
        :checked="bool(key, field)"
        type="checkbox"
        @change="set(key, ($event.target as HTMLInputElement).checked)"
      />

      <select
        v-else-if="field.type === 'select'"
        :value="str(key) || (field.default as string | undefined) || ''"
        @change="set(key, ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
      </select>

      <select
        v-else-if="field.type === 'view'"
        :value="str(key)"
        @change="set(key, ($event.target as HTMLSelectElement).value)"
      >
        <option value="">{{ t('editor.noViewTarget') }}</option>
        <option v-for="v in store.config.views" :key="v.id" :value="v.id">{{ v.title }}</option>
      </select>
    </label>
  </div>
</template>

<style scoped>
.schema-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field.type-boolean {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}
.label {
  font-size: 13px;
  color: var(--text-secondary);
}
</style>
