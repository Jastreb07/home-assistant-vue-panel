<script setup lang="ts">
import { themed } from '@/theme/registry'

const VariableCard = themed('VariableCard')

defineProps<{
  title: string
  marker?: string | number
  defaultOpen?: boolean
  removeLabel: string
}>()
const emit = defineEmits<{ remove: [] }>()
</script>

<template>
  <component
    :is="VariableCard"
    :title="title"
    :marker="marker"
    :default-open="defaultOpen"
    :remove-label="removeLabel"
    @remove="emit('remove')"
  >
    <slot />
  </component>
</template>
