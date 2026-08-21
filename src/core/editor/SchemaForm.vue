<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CardSchemaField } from '@/core/registry/cardRegistry'
import type { CardTranslations } from '@/core/registry/portableCardTypes'
import { cardText } from '@/core/registry/cardTranslations'
import { isVisible } from '@/core/registry/cardConditions'
import BaseCollapsible from '@/core/ui/BaseCollapsible.vue'
import SchemaFieldRow from './SchemaFieldRow.vue'

const props = withDefaults(
  defineProps<{
    schema: Record<string, CardSchemaField>
    modelValue: Record<string, unknown>
    /** Catalogs of the card whose settings are edited here */
    translations?: CardTranslations
    /** Off for the fields of a single list entry — those stay a flat form */
    grouped?: boolean
  }>(),
  { grouped: true },
)
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, unknown>] }>()

const { t, locale } = useI18n()

function set(key: string, value: unknown) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

interface FieldEntry {
  key: string
  field: CardSchemaField
}

/**
 * Conditions read the current settings; a field the user has not touched yet
 * still counts with the default the card ships.
 */
const conditionValues = computed<Record<string, unknown>>(() => {
  const values: Record<string, unknown> = {}
  for (const [key, field] of Object.entries(props.schema)) {
    if (field.default !== undefined) values[key] = field.default
  }
  return { ...values, ...props.modelValue }
})

/** Fields a card hides until another of its settings has the right value. */
const visibleFields = computed<FieldEntry[]>(() =>
  Object.entries(props.schema)
    .filter(([, field]) => isVisible(field.visibleIf, conditionValues.value))
    .map(([key, field]) => ({ key, field })),
)

/** Entities pick what a card shows — they stay above the collapsed boxes. */
const entityFields = computed<FieldEntry[]>(() =>
  visibleFields.value.filter(({ field }) => !props.grouped || field.type === 'entity'),
)

/**
 * Every other field lives in a collapsible box: the one named by its `group`,
 * or a shared fallback box for fields a card leaves ungrouped. The boxes keep
 * the order in which their group first appears in the schema.
 */
const fieldGroups = computed<Array<{ title: string; fields: FieldEntry[] }>>(() => {
  const groups = new Map<string, FieldEntry[]>()
  if (!props.grouped) return []
  for (const { key, field } of visibleFields.value) {
    if (field.type === 'entity') continue
    const group = field.group?.trim()
    const title = group
      ? cardText(props.translations, group, locale.value)
      : t('editor.fieldGroupOther')
    const fields = groups.get(title)
    if (fields) fields.push({ key, field })
    else groups.set(title, [{ key, field }])
  }
  return [...groups].map(([title, fields]) => ({ title, fields }))
})
</script>

<template>
  <div class="schema-form">
    <SchemaFieldRow
      v-for="entry in entityFields"
      :key="entry.key"
      :field="entry.field"
      :translations="translations"
      :value="modelValue[entry.key]"
      @update:value="set(entry.key, $event)"
    />

    <!-- Grouped settings start collapsed so the dialog opens on the essentials. -->
    <BaseCollapsible
      v-for="group in fieldGroups"
      :key="group.title"
      :title="group.title"
      icon="mdi:tune"
    >
      <div class="schema-group">
        <SchemaFieldRow
          v-for="entry in group.fields"
          :key="entry.key"
          :field="entry.field"
          :translations="translations"
          :value="modelValue[entry.key]"
          @update:value="set(entry.key, $event)"
        />
      </div>
    </BaseCollapsible>
  </div>
</template>

<style scoped>
.schema-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.schema-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
