<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { NavAlign } from '@/core/config/types'
import { useDashboardStore } from '@/core/config/dashboardStore'
import HeaderSettingsDialog from '@/core/editor/HeaderSettingsDialog.vue'
import MdiIcon from '@/core/ui/MdiIcon.vue'
import NavCards from './NavCards.vue'

/**
 * Header bar — the horizontal counterpart of the sidebar, with the same
 * three card slots (left, center, right). Per-view visibility comes
 * from `view.showHeader`.
 */
const { t } = useI18n()
const store = useDashboardStore()

const settingsOpen = ref(false)

const FLEX_ALIGN: Record<NavAlign, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
}

const centerStyle = computed(() => {
  const { vertical, horizontal } = store.header.centerAlign
  return {
    // The main axis is horizontal here — mirrored against the sidebar
    justifyContent: horizontal === 'stretch' ? 'space-between' : FLEX_ALIGN[horizontal],
    alignItems: FLEX_ALIGN[vertical],
  }
})
</script>

<template>
  <header class="header-bar" :style="{ height: store.header.height + 'px' }">
    <div class="slot slot-left">
      <NavCards bar="header" nav-slot="left" direction="row" />
    </div>

    <div class="slot slot-center" :style="centerStyle">
      <NavCards bar="header" nav-slot="center" direction="row" />
    </div>

    <div class="slot slot-right">
      <NavCards bar="header" nav-slot="right" direction="row" />
    </div>

    <button
      v-if="store.editMode"
      class="header-settings-btn"
      :title="t('editor.header.title')"
      @click="settingsOpen = true"
    >
      <MdiIcon icon="mdi:dock-top" :size="18" />
    </button>

    <HeaderSettingsDialog v-if="settingsOpen" @close="settingsOpen = false" />
  </header>
</template>

<style scoped>
.header-bar {
  flex-shrink: 0;
  display: flex;
  align-items: stretch;
  gap: 16px;
  padding: 8px 16px;
  background: var(--nav-bg);
  border-bottom: 1px solid var(--divider);
  overflow-x: auto;
}
.slot {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
/* The center slot takes the free space — its content is aligned via centerAlign */
.slot-center {
  flex: 1;
}
.header-settings-btn {
  flex-shrink: 0;
  align-self: center;
  border: 1px solid var(--divider);
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.header-settings-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}
</style>
