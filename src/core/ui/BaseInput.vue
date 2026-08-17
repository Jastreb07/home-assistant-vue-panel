<script setup lang="ts">
import { themed } from '@/theme/registry'
import type { ControlSize } from './controlSize'

/** Thin wrapper: renders the 'Input' component of the active theme. */
const Input = themed('Input')

defineProps<{
  modelValue: string | number
  type?: 'text' | 'number'
  size?: ControlSize
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  spellcheck?: boolean
  min?: number | string
  max?: number | string
  step?: number | string
  /** id of a <datalist> for native suggestions */
  list?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string | number] }>()
</script>

<template>
  <component
    :is="Input"
    :model-value="modelValue"
    :type="type"
    :size="size"
    :placeholder="placeholder"
    :disabled="disabled"
    :invalid="invalid"
    :spellcheck="spellcheck"
    :min="min"
    :max="max"
    :step="step"
    :list="list"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
