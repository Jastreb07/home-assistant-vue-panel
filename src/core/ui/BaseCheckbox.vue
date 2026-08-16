<script setup lang="ts">
import { themed } from '@/theme/registry'

/** Thin wrapper: renders the 'Checkbox' component of the active theme. */
const Checkbox = themed('Checkbox')

defineProps<{
  modelValue: boolean
  disabled?: boolean
  /** Optional text next to the box */
  label?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <component
    :is="Checkbox"
    :model-value="modelValue"
    :disabled="disabled"
    :label="label"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
