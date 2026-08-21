<script setup lang="ts">
import { themed } from '@/theme/registry'

/** Thin wrapper: renders the 'Splitter' component of the active theme. */
const Splitter = themed('Splitter')

defineProps<{
  share: number
  minPane?: number
  label?: string
}>()
const emit = defineEmits<{
  'update:share': [value: number]
  'update:dragging': [value: boolean]
}>()
</script>

<template>
  <component
    :is="Splitter"
    :share="share"
    :min-pane="minPane"
    :label="label"
    @update:share="emit('update:share', $event)"
    @update:dragging="emit('update:dragging', $event)"
  />
</template>
