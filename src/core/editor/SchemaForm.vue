<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CardSchemaField } from '@/core/registry/cardRegistry'
import { useDashboardStore } from '@/core/config/dashboardStore'
import BaseSelectMenu from '@/core/ui/BaseSelectMenu.vue'
import { mdiIconOptions } from '@/core/ui/mdiIconNames'
import type { SelectOption } from '@/core/ui/selectMenu'
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

/** Icons are read from the loaded mdi stylesheet — resolved once. */
const iconOptions = computed<SelectOption[]>(() =>
  Object.values(props.schema).some((f) => f.type === 'icon') ? mdiIconOptions() : [],
)

const viewOptions = computed<SelectOption[]>(() => [
  { value: '', label: t('editor.noViewTarget') },
  ...store.config.views.map((v) => ({ value: v.id, label: v.title, icon: v.icon })),
])

function selectOptions(field: CardSchemaField): SelectOption[] {
  return (field.options ?? []).map((opt) => ({ value: opt, label: opt }))
}

/** SelectMenu renders buttons — a <label> would forward clicks to them. */
function isMenuField(field: CardSchemaField): boolean {
  return field.type === 'icon' || field.type === 'select' || field.type === 'view'
}
</script>

<template>
  <div class="schema-form">
    <component
      :is="isMenuField(field) ? 'div' : 'label'"
      v-for="(field, key) in schema"
      :key="key"
      class="field"
      :class="'type-' + field.type"
    >
      <span class="label">
        {{ t(field.label) }}<span v-if="!field.optional && field.type === 'entity'"> *</span>
      </span>

      <EntityPicker
        v-if="field.type === 'entity'"
        :model-value="str(key)"
        :domain="field.domain"
        @update:model-value="set(key, $event)"
      />

      <BaseSelectMenu
        v-else-if="field.type === 'icon'"
        :model-value="str(key)"
        :options="iconOptions"
        searchable
        allow-custom
        custom-prefix="mdi:"
        :clearable="field.optional"
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

      <BaseSelectMenu
        v-else-if="field.type === 'select'"
        :model-value="str(key) || (field.default as string | undefined) || ''"
        :options="selectOptions(field)"
        @update:model-value="set(key, $event)"
      />

      <BaseSelectMenu
        v-else-if="field.type === 'view'"
        :model-value="str(key)"
        :options="viewOptions"
        :placeholder="t('editor.noViewTarget')"
        @update:model-value="set(key, $event)"
      />
    </component>
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
