<script setup lang="ts">
import { computed } from 'vue'
import { useEntities } from '@/core/ha'
import BaseSelectMenu from '@/core/ui/BaseSelectMenu.vue'
import type { SelectOption } from '@/core/ui/selectMenu'

const props = defineProps<{
  modelValue: string
  /** Restrict to a domain, e.g. 'light' */
  domain?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const entities = useEntities()

const options = computed<SelectOption[]>(() =>
  Object.values(entities.value)
    .filter((e) => !props.domain || e.entity_id.startsWith(props.domain + '.'))
    .map((e) => ({
      value: e.entity_id,
      label: (e.attributes.friendly_name as string | undefined) ?? e.entity_id,
    }))
    .sort((a, b) => a.label.localeCompare(b.label)),
)
</script>

<template>
  <BaseSelectMenu
    :model-value="modelValue"
    :options="options"
    searchable
    clearable
    allow-custom
    :placeholder="domain ? `${domain}.…` : 'domain.entity_id'"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
