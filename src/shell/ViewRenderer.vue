<script setup lang="ts">
import { computed, type Component } from 'vue'
import type { ViewConfig } from '@/core/config/types'
import { boxToCss } from '@/core/ui/boxInput'
import SectionsLayout from '@/layouts/SectionsLayout.vue'
import FlexLayout from '@/layouts/FlexLayout.vue'
import GridLayout from '@/layouts/GridLayout.vue'
import SidebarLayout from '@/layouts/SidebarLayout.vue'
import PanelLayout from '@/layouts/PanelLayout.vue'

const props = defineProps<{ view: ViewConfig }>()

const layouts: Record<string, Component> = {
  sections: SectionsLayout,
  flex: FlexLayout,
  // Legacy alias — 'tiles' was replaced by the flex layout
  tiles: FlexLayout,
  grid: GridLayout,
  sidebar: SidebarLayout,
  panel: PanelLayout,
}

const layoutComponent = computed(() => layouts[props.view.layout] ?? SectionsLayout)

/** The auto margins that push a layout to the left / center / right. */
const alignMargins: Record<string, string> = {
  left: '0 auto 0 0',
  center: '0 auto',
  right: '0 0 0 auto',
}

/**
 * Advanced view options: spacing around the layout, content width and
 * horizontal alignment. The layouts read `--view-max-width` and
 * `--view-align` instead of hard-coding their maximum and `margin: 0 auto`.
 */
const boxStyle = computed(() => {
  const style: Record<string, string> = {}
  const padding = boxToCss(props.view.padding)
  const margin = boxToCss(props.view.margin)
  if (padding) style.padding = padding
  if (margin) style.margin = margin
  if (props.view.width === 'full') style['--view-max-width'] = 'none'
  const align = props.view.align
  if (align && align !== 'center') style['--view-align'] = alignMargins[align]!
  return style
})
</script>

<template>
  <div class="view-box" :style="boxStyle">
    <component :is="layoutComponent" :view="view" />
  </div>
</template>
