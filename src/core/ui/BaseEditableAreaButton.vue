<script setup lang="ts">
import { themed } from '@/theme/registry'

/** Thin wrapper: renders the 'EditableAreaButton' component of the active theme. */
const EditableAreaButton = themed('EditableAreaButton')

withDefaults(
  defineProps<{
    /** 'drag' shows a grab cursor for drag-handle buttons */
    variant?: 'default' | 'drag'
  }>(),
  { variant: 'default' },
)
</script>

<template>
  <component :is="EditableAreaButton" :variant="variant">
    <slot />
  </component>
</template>
