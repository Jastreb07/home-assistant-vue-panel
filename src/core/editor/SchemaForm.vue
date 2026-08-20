<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CardSchemaField } from '@/core/registry/cardRegistry'
import { useDashboardStore } from '@/core/config/dashboardStore'
import BaseSelectMenu from '@/core/ui/BaseSelectMenu.vue'
import BaseInput from '@/core/ui/BaseInput.vue'
import BaseCheckbox from '@/core/ui/BaseCheckbox.vue'
import { mdiIconOptions } from '@/core/ui/mdiIconNames'
import type { SelectOption } from '@/core/ui/selectMenu'
import EntityPicker from './EntityPicker.vue'
import ListField from './ListField.vue'

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
  return (field.options ?? []).map((opt) => ({
    value: opt,
    label: field.optionLabels?.[opt]
      ? field.literalOptionLabels ? field.optionLabels[opt] : t(field.optionLabels[opt])
      : opt,
  }))
}

/**
 * SelectMenu renders buttons and Checkbox renders its own <label> —
 * wrapping either in a <label> would forward (and double) clicks.
 */
function needsPlainWrapper(field: CardSchemaField): boolean {
  return ['icon', 'select', 'view', 'boolean', 'list'].includes(field.type)
}
</script>

<template>
  <div class="schema-form">
    <component
      :is="needsPlainWrapper(field) ? 'div' : 'label'"
      v-for="(field, key) in schema"
      :key="key"
      class="field"
      :class="'type-' + field.type"
    >
      <span class="label">
        {{ field.literalLabel ? field.label : t(field.label) }}<span v-if="field.required || (!field.optional && field.type === 'entity')"> *</span>
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

      <BaseInput
        v-else-if="field.type === 'string'"
        :model-value="str(key)"
        @update:model-value="set(key, $event)"
      />

      <BaseInput
        v-else-if="field.type === 'number'"
        :model-value="(modelValue[key] as number | undefined) ?? (field.default as number | undefined) ?? 0"
        type="number"
        :min="field.min"
        :max="field.max"
        :step="field.step"
        @update:model-value="set(key, Number($event))"
      />

      <BaseCheckbox
        v-else-if="field.type === 'boolean'"
        :model-value="bool(key, field)"
        @update:model-value="set(key, $event)"
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

      <ListField
        v-else-if="field.type === 'list'"
        :field="field"
        :model-value="modelValue[key]"
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
