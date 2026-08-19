<script setup lang="ts">
import { computed } from 'vue'
import type { BarAlign, BarPosition } from '@/core/config/types'
import { barSizeLimits, useDashboardStore } from '@/core/config/dashboardStore'
import BarSlotCards from '@/core/editor/BarSlotCards.vue'
import CardCss from '@/core/ui/CardCss.vue'

/**
 * A global bar: an engine-rendered container with three card slots. The
 * sidebar stacks them top to bottom, the header and bottom bars left to
 * right. Only the center slot grows, so `centerAlign` decides where its
 * content sits in the space the outer slots leave over.
 */
const props = defineProps<{ position: BarPosition }>()

const FLEX_ALIGN: Record<BarAlign, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
}

const store = useDashboardStore()
const bar = computed(() => store.bars[props.position])
const vertical = computed(() => bar.value.centerAlign.vertical)
const horizontal = computed(() => bar.value.centerAlign.horizontal)
const isSidebar = computed(() => props.position === 'sidebar')
const direction = computed<'column' | 'row'>(() => (isSidebar.value ? 'column' : 'row'))

const hostStyle = computed(() => {
  const limits = barSizeLimits[props.position]
  const size = Math.min(limits.max, Math.max(limits.min, Number(bar.value.size) || limits.min))
  return isSidebar.value ? { width: `${size}px` } : { height: `${size}px` }
})

/**
 * The alignment is handed to the center slot's own card container as custom
 * properties: the main axis runs along the bar, the cross axis across it.
 */
const centerStyle = computed(() => {
  const main = isSidebar.value ? vertical.value : horizontal.value
  const cross = isSidebar.value ? horizontal.value : vertical.value
  return {
    '--bar-main-align': main === 'stretch' ? 'space-between' : FLEX_ALIGN[main],
    '--bar-cross-align': FLEX_ALIGN[cross],
    // Spreading the cards keeps their own size; otherwise they fill the slot
    '--bar-card-grow': main === 'stretch' ? '0' : '1',
    // 'initial' makes the cards fall back to their own size across the bar
    '--bar-card-cross': cross === 'stretch' ? '100%' : 'initial',
  }
})
</script>

<template>
  <component
    :is="isSidebar ? 'nav' : position === 'header' ? 'header' : 'footer'"
    class="shell-bar-host"
    :class="`shell-bar-host--${position}`"
    :data-vp-card="bar.css ? bar.id : undefined"
    :style="hostStyle"
  >
    <CardCss :card-id="bar.id" :css="bar.css ?? ''">
      <BarSlotCards :bar="position" bar-slot="start" :direction="direction" />
      <div class="bar-center" :style="centerStyle">
        <BarSlotCards :bar="position" bar-slot="center" :direction="direction" />
      </div>
      <BarSlotCards :bar="position" bar-slot="end" :direction="direction" />
    </CardCss>
  </component>
</template>

<style scoped>
.shell-bar-host {
  position: relative;
  flex-shrink: 0;
  min-width: 0;
  z-index: 2;
  box-sizing: border-box;
  display: flex;
  background: var(--nav-bg);
}
.shell-bar-host--sidebar {
  height: 100%;
  flex-direction: column;
  gap: 24px;
  padding: 24px 16px;
  border-right: 1px solid var(--divider);
  overflow-y: auto;
}
.shell-bar-host--header,
.shell-bar-host--bottom {
  width: 100%;
  align-items: stretch;
  gap: 16px;
  padding: 8px 16px;
  overflow-x: auto;
}
.shell-bar-host--header {
  border-bottom: 1px solid var(--divider);
}
.shell-bar-host--bottom {
  border-top: 1px solid var(--divider);
}
/* The outer slots keep their cards centered across a horizontal bar … */
.shell-bar-host--header > :deep(.bar-slot-cards),
.shell-bar-host--bottom > :deep(.bar-slot-cards) {
  align-items: center;
}
/* … and full width in the sidebar column. */
.shell-bar-host--sidebar > :deep(.bar-slot-cards) {
  --bar-card-cross: 100%;
}
.bar-center {
  flex: 1;
  display: flex;
  min-width: 0;
  min-height: 0;
}
/* The slot container itself carries the alignment so it moves the cards. */
.bar-center > :deep(.bar-slot-cards) {
  flex: 1;
  justify-content: var(--bar-main-align);
  align-items: var(--bar-cross-align);
}
</style>
