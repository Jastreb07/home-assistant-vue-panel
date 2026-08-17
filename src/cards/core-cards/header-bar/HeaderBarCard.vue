<script setup lang="ts">
import { computed } from 'vue'
import type { NavAlign } from '@/core/config/types'
import { useDashboardStore } from '@/core/config/dashboardStore'
import BarCards from '@/core/editor/BarCards.vue'

const props = defineProps<{
  config: { height?: number; verticalAlign?: NavAlign; horizontalAlign?: NavAlign }
}>()

const store = useDashboardStore()

const FLEX_ALIGN: Record<NavAlign, string> = {
  start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch',
}

const centerStyle = computed(() => {
  const vertical = props.config.verticalAlign ?? store.header.centerAlign.vertical
  const horizontal = props.config.horizontalAlign ?? store.header.centerAlign.horizontal
  return {
    justifyContent: horizontal === 'stretch' ? 'space-between' : FLEX_ALIGN[horizontal],
    alignItems: FLEX_ALIGN[vertical],
  }
})

const height = computed(() => {
  const value = Number(props.config.height ?? store.header.height)
  return Math.min(Math.max(value || 64, 40), 240)
})
</script>

<template>
  <header class="header-bar-card" :style="{ height: height + 'px' }">
    <div class="slot"><BarCards bar="header" bar-slot="left" direction="row" /></div>
    <div class="slot slot-center" :style="centerStyle">
      <BarCards bar="header" bar-slot="center" direction="row" />
    </div>
    <div class="slot"><BarCards bar="header" bar-slot="right" direction="row" /></div>
  </header>
</template>

<style scoped>
.header-bar-card {
  flex-shrink: 0;
  box-sizing: border-box;
  display: flex;
  align-items: stretch;
  gap: 16px;
  padding: 8px 16px;
  background: var(--nav-bg);
  border-bottom: 1px solid var(--divider);
  overflow-x: auto;
}
.slot { display: flex; align-items: center; gap: 12px; min-width: 0; }
.slot-center { flex: 1; }
</style>
