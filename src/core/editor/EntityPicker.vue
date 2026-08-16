<script setup lang="ts">
import { computed, useId } from 'vue'
import { useEntities } from '@/core/ha'

const props = defineProps<{
  modelValue: string
  /** Restrict to a domain, e.g. 'light' */
  domain?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const listId = useId()
const entities = useEntities()

const options = computed(() =>
  Object.values(entities.value)
    .filter((e) => !props.domain || e.entity_id.startsWith(props.domain + '.'))
    .map((e) => ({
      id: e.entity_id,
      name: (e.attributes.friendly_name as string | undefined) ?? e.entity_id,
    }))
    .sort((a, b) => a.name.localeCompare(b.name)),
)
</script>

<template>
  <input
    class="entity-input"
    :value="modelValue"
    :list="listId"
    :placeholder="domain ? `${domain}.…` : 'domain.entity_id'"
    spellcheck="false"
    @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
  <datalist :id="listId">
    <option v-for="opt in options" :key="opt.id" :value="opt.id">{{ opt.name }}</option>
  </datalist>
</template>

<style scoped>
.entity-input {
  width: 100%;
}
</style>
