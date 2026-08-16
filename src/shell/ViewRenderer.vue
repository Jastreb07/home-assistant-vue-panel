<script setup lang="ts">
import { computed, type Component } from 'vue'
import type { ViewConfig } from '@/core/config/types'
import SectionsLayout from '@/layouts/SectionsLayout.vue'
import TilesLayout from '@/layouts/TilesLayout.vue'
import GridLayout from '@/layouts/GridLayout.vue'
import SidebarLayout from '@/layouts/SidebarLayout.vue'
import PanelLayout from '@/layouts/PanelLayout.vue'

const props = defineProps<{ view: ViewConfig }>()

const layouts: Record<string, Component> = {
  sections: SectionsLayout,
  tiles: TilesLayout,
  grid: GridLayout,
  sidebar: SidebarLayout,
  panel: PanelLayout,
}

const layoutComponent = computed(() => layouts[props.view.layout] ?? SectionsLayout)
</script>

<template>
  <component :is="layoutComponent" :view="view" />
</template>
