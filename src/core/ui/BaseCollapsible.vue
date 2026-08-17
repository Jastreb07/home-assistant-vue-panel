<script setup lang="ts">
import { themed } from '@/theme/registry'

/** Thin wrapper: renders the 'Collapsible' component of the active theme. */
const Collapsible = themed('Collapsible')

defineProps<{
  title: string
  /** Optional mdi icon in front of the title */
  icon?: string
  /** Start expanded — collapsed by default, so only the lead box is open */
  defaultOpen?: boolean
}>()
</script>

<template>
  <component :is="Collapsible" :title="title" :icon="icon" :default-open="defaultOpen">
    <slot />
  </component>
</template>
