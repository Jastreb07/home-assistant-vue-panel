<script setup lang="ts">
import { themed } from '@/theme/registry'

/** Thin wrapper: renders the 'CodeEditor' component of the active theme. */
const CodeEditor = themed('CodeEditor')

defineProps<{
  modelValue: string
  /** Only 'css' is wired up so far */
  language?: 'css'
  minHeight?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <component
    :is="CodeEditor"
    :model-value="modelValue"
    :language="language"
    :min-height="minHeight"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
