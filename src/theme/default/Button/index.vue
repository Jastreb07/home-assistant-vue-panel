<script setup lang="ts">
import type { ControlSize } from '@/core/ui/controlSize'

withDefaults(
  defineProps<{
    variant?: 'default' | 'primary' | 'danger'
    disabled?: boolean
    /** Shares the scale with Input and SelectMenu */
    size?: ControlSize
  }>(),
  { size: 'md' },
)
</script>

<template>
  <button class="vp-btn" :class="[variant, `vp-size-${size}`]" :disabled="disabled">
    <slot />
  </button>
</template>
