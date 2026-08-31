<script setup lang="ts">
import { themed } from '@/theme/registry'
import type { ColorFormat } from '@/core/ui/color'

/** Thin wrapper: renders the ColorPicker component of the active theme. */
const ColorPicker = themed('ColorPicker')

defineProps<{
  modelValue: string
  defaultFormat?: ColorFormat
  placeholder?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <component
    :is="ColorPicker"
    :model-value="modelValue"
    :default-format="defaultFormat"
    :placeholder="placeholder"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
