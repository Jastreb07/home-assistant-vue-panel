<script setup lang="ts">
import { themed } from '@/theme/registry'
import type { TabItem } from './tabs'

/** Thin wrapper: renders the 'Tabs' component of the active theme. */
const Tabs = themed('Tabs')

defineProps<{
  modelValue: string
  items: TabItem[]
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <component
    :is="Tabs"
    :model-value="modelValue"
    :items="items"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
