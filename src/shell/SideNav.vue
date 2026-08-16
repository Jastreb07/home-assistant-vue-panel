<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { NavAlign } from '@/core/config/types'
import { useDashboardStore } from '@/core/config/dashboardStore'
import NavSettingsDialog from '@/core/editor/NavSettingsDialog.vue'
import MdiIcon from '@/core/ui/MdiIcon.vue'
import NavCards from './NavCards.vue'

/**
 * Sidebar with three card slots: top, center (fills the free space)
 * and bottom. Everything in it is a card — the view navigation is the
 * 'menu' card, a clock is the 'clock' card.
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
  const { vertical, horizontal } = store.nav.centerAlign
  return {
    // justify-content has no 'stretch' — spread the cards instead
    justifyContent: vertical === 'stretch' ? 'space-between' : FLEX_ALIGN[vertical],
    alignItems: FLEX_ALIGN[horizontal],
  }
})
</script>

<template>
  <nav class="side-nav" :style="{ width: store.nav.width + 'px' }">
    <header v-if="store.editMode" class="nav-toolbar">
      <button class="nav-settings-btn" :title="t('editor.nav.title')" @click="settingsOpen = true">
        <MdiIcon icon="mdi:dock-left" :size="18" />
      </button>
    </header>

    <div class="slot slot-top">
      <NavCards nav-slot="top" direction="column" />
    </div>

    <div class="slot slot-center" :style="centerStyle">
      <NavCards nav-slot="center" direction="column" />
    </div>

    <div class="slot slot-bottom">
      <NavCards nav-slot="bottom" direction="column" />
    </div>

    <NavSettingsDialog v-if="settingsOpen" @close="settingsOpen = false" />
  </nav>
</template>

<style scoped>
.side-nav {
  /* width comes from nav.width */
  flex-shrink: 0;
  background: var(--nav-bg);
  display: flex;
  flex-direction: column;
  padding: 24px 16px;
  gap: 24px;
  overflow-y: auto;
}
/* Edit-mode toolbar, pinned to the top right of the sidebar */
.nav-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: -12px;
}
.nav-settings-btn {
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
.nav-settings-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.slot {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
/* The center slot takes the free space — its content is aligned via centerAlign */
.slot-center {
  flex: 1;
}
</style>
