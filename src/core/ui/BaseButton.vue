<script setup lang="ts">
import { themed } from '@/theme/registry'
import type { ControlSize } from './controlSize'

/** Thin wrapper: renders the 'Button' component of the active theme. */
const Button = themed('Button')

defineProps<{
  variant?: 'default' | 'primary' | 'danger'
  disabled?: boolean
  /** Shares the scale with Input and SelectMenu */
  size?: ControlSize
}>()
</script>

<template>
  <component :is="Button" :variant="variant" :disabled="disabled" :size="size">
    <slot />
  </component>
</template>
