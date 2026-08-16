<script setup lang="ts">
import { themed } from '@/theme/registry'
import type { ControlSize } from './controlSize'

/** Thin wrapper: renders the 'AddTile' component of the active theme. */
const AddTile = themed('AddTile')

defineProps<{
  label?: string
  icon?: string
  /** 'tile' = dashed block, 'pill' = rounded inline button */
  variant?: 'tile' | 'pill'
  /** Icon above the label, or next to it */
  orientation?: 'vertical' | 'horizontal'
  size?: ControlSize
  /** Grow to fill the available height (panel layout) */
  fill?: boolean
}>()
</script>

<template>
  <component
    :is="AddTile"
    :label="label"
    :icon="icon"
    :variant="variant"
    :orientation="orientation"
    :size="size"
    :fill="fill"
  />
</template>
