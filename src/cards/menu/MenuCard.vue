<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDashboardStore, viewPath } from '@/core/config/dashboardStore'
import MdiIcon from '@/core/ui/MdiIcon.vue'
import type { MenuItem } from './items'

/**
 * The navigation as a card. Items are built in the card editor like a
 * WordPress menu: free labels, own order and up to three levels.
 * Without items the card falls back to listing every page.
 */
const props = defineProps<{
  config: {
    items?: MenuItem[]
    orientation?: 'vertical' | 'horizontal'
    showTitles?: boolean
    showIcons?: boolean
  }
}>()

const store = useDashboardStore()
const route = useRoute()
const router = useRouter()

/** No menu built yet → show all pages, like WordPress does without a menu. */
const items = computed<MenuItem[]>(() => {
  const configured = props.config.items
  if (configured?.length) return configured
  return store.config.views.map((v) => ({
    id: `auto-${v.id}`,
    label: v.title,
    icon: v.icon,
    viewId: v.id,
    depth: 0,
  }))
})

/** Menu items reference view ids, the URL carries the view's path. */
const activeId = computed(() => {
  const segment = route.params.viewId as string
  const view = segment ? store.viewByRoute(segment) : store.config.views[0]
  return view?.id
})

const showTitles = computed(() => props.config.showTitles !== false)
const showIcons = computed(() => props.config.showIcons !== false)

function activate(item: MenuItem) {
  const view = item.viewId ? store.viewById(item.viewId) : undefined
  if (view) router.push({ params: { viewId: viewPath(view) } })
}
</script>

<template>
  <nav class="menu-card" :class="config.orientation === 'horizontal' ? 'horizontal' : 'vertical'">
    <component
      :is="item.viewId ? 'button' : 'div'"
      v-for="item in items"
      :key="item.id"
      class="item"
      :class="{
        active: item.viewId && item.viewId === activeId,
        group: !item.viewId,
        'icon-only': !showTitles,
      }"
      :style="item.depth > 0 ? { marginInlineStart: item.depth * 16 + 'px' } : undefined"
      @click="activate(item)"
    >
      <span v-if="showTitles" class="label">{{ item.label }}</span>
      <MdiIcon v-if="showIcons && item.icon" :icon="item.icon" :size="22" />
    </component>
  </nav>
</template>

<style scoped>
.menu-card {
  display: flex;
  gap: 8px;
  min-width: 0;
}
.menu-card.vertical {
  flex-direction: column;
}
.menu-card.horizontal {
  flex-direction: row;
  flex-wrap: wrap;
}
.item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  border: none;
  border-radius: 28px;
  background: transparent;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 16px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: background 0.2s;
}
.menu-card.vertical .item {
  width: 100%;
}
.item.icon-only {
  justify-content: center;
  padding: 14px;
}
/* Items without a target are headings, not buttons */
.item.group {
  cursor: default;
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-secondary);
  padding: 8px 18px;
}
.label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.item:not(.group):hover {
  background: var(--nav-item-hover);
}
.item.active {
  background: var(--nav-item-active);
}
</style>
