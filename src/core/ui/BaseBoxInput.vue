<script setup lang="ts">
import { themed } from '@/theme/registry'
import type { BoxValue } from './boxInput'

/** Thin wrapper: renders the 'BoxInput' component of the active theme. */
const BoxInput = themed('BoxInput')

defineProps<{
  modelValue?: BoxValue
  label?: string
  /** Lowest accepted number — margins may be negative, paddings not */
  min?: number
}>()
const emit = defineEmits<{ 'update:modelValue': [value: BoxValue] }>()
</script>

<template>
  <component
    :is="BoxInput"
    :model-value="modelValue"
    :label="label"
    :min="min"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
