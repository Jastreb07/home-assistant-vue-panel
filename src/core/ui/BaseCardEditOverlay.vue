<script setup lang="ts">
import { themed } from '@/theme/registry'

/** Thin wrapper: renders the CardEditOverlay component of the active theme. */
const CardEditOverlay = themed('CardEditOverlay')

defineProps<{
  reserveResizeCorner?: boolean
}>()

const emit = defineEmits<{
  edit: []
  duplicate: []
  copy: []
  cut: []
  delete: []
}>()
</script>

<template>
  <component
    :is="CardEditOverlay"
    :reserve-resize-corner="reserveResizeCorner"
    @edit="emit('edit')"
    @duplicate="emit('duplicate')"
    @copy="emit('copy')"
    @cut="emit('cut')"
    @delete="emit('delete')"
  />
</template>
