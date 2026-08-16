<script setup lang="ts">
import { themed } from '@/theme/registry'

/** Thin wrapper: renders the 'Button' component of the active theme. */
const Button = themed('Button')

defineProps<{
  variant?: 'default' | 'primary' | 'danger'
  disabled?: boolean
}>()
</script>

<template>
  <component :is="Button" :variant="variant" :disabled="disabled">
    <slot />
  </component>
</template>
