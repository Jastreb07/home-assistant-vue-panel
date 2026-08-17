<script setup lang="ts">
import { computed } from 'vue'
import type { NavAlign } from '@/core/config/types'
import { useDashboardStore } from '@/core/config/dashboardStore'
import BarCards from '@/core/editor/BarCards.vue'

const props = defineProps<{
  config: { width?: number; verticalAlign?: NavAlign; horizontalAlign?: NavAlign }
}>()

const store = useDashboardStore()

const FLEX_ALIGN: Record<NavAlign, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
}

const centerStyle = computed(() => {
  const vertical = props.config.verticalAlign ?? store.nav.centerAlign.vertical
  const horizontal = props.config.horizontalAlign ?? store.nav.centerAlign.horizontal
  return {
    justifyContent: vertical === 'stretch' ? 'space-between' : FLEX_ALIGN[vertical],
    alignItems: FLEX_ALIGN[horizontal],
  }
})

const width = computed(() => {
  const value = Number(props.config.width ?? store.nav.width)
  return Math.min(Math.max(value || 280, 160), 560)
})
</script>

<template>
  <nav class="sidebar-bar-card" :style="{ width: width + 'px' }">
    <div class="slot"><BarCards bar="sidebar" bar-slot="top" direction="column" /></div>
    <div class="slot slot-center" :style="centerStyle">
      <BarCards bar="sidebar" bar-slot="center" direction="column" />
    </div>
    <div class="slot"><BarCards bar="sidebar" bar-slot="bottom" direction="column" /></div>
  </nav>
</template>

<style scoped>
.sidebar-bar-card {
  flex-shrink: 0;
  height: 100%;
  box-sizing: border-box;
  background: var(--nav-bg);
  display: flex;
  flex-direction: column;
  padding: 24px 16px;
  gap: 24px;
  border-right: 1px solid var(--divider);
  overflow-y: auto;
}
.slot {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
.slot-center {
  flex: 1;
}
</style>
