<script setup lang="ts">
import { themed } from '@/theme/registry'

/** Thin wrapper: renders the 'CollapsibleAdvanced' component of the active theme. */
const CollapsibleAdvanced = themed('CollapsibleAdvanced')

defineProps<{
  title: string
  subtitle?: string
  marker?: string | number
  defaultOpen?: boolean
  removeLabel: string
}>()
const emit = defineEmits<{ remove: [] }>()
</script>

<template>
  <component
    :is="CollapsibleAdvanced"
    :title="title"
    :subtitle="subtitle"
    :marker="marker"
    :default-open="defaultOpen"
    :remove-label="removeLabel"
    @remove="emit('remove')"
  >
    <slot />
  </component>
</template>
