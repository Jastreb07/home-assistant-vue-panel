<script setup lang="ts">
import { computed } from 'vue'
import MdiIcon from '@/core/ui/MdiIcon.vue'
import type { ControlSize } from '@/core/ui/controlSize'

/**
 * Dashed "add something" affordance — used for cards, sections and
 * nav slots. Renders a plain button, so consumers just bind @click.
 */
const props = withDefaults(
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
  }>(),
  { icon: 'mdi:plus', variant: 'tile', orientation: 'vertical', size: 'md' },
)

/** Tiles carry a larger glyph than inline pills at the same size. */
const ICON_SIZE: Record<ControlSize, number> = { xs: 14, sm: 18, md: 22, lg: 26, xl: 30 }

const iconSize = computed(() => {
  const base = ICON_SIZE[props.size]
  return props.orientation === 'vertical' ? base + 6 : base
})
</script>

<template>
  <button
    type="button"
    class="vp-add-tile"
    :class="[
      `vp-add-tile--${variant}`,
      `vp-add-tile--${orientation}`,
      `vp-size-${size}`,
      { 'vp-add-tile--fill': fill },
    ]"
  >
    <MdiIcon :icon="icon" :size="iconSize" />
    <span v-if="label">{{ label }}</span>
  </button>
</template>
