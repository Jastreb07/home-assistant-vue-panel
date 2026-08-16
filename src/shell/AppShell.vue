<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useDashboardStore } from '@/core/config/dashboardStore'
import { useMediaQuery } from '@/core/composables/useMediaQuery'
import { useTheme } from '@/core/composables/useTheme'
import { useIdleSeconds } from '@/core/kiosk/useIdleSeconds'
import Screensaver from '@/core/kiosk/Screensaver.vue'
import EditFab from '@/core/editor/EditFab.vue'
import ViewSettingsDialog from '@/core/editor/ViewSettingsDialog.vue'
import DashboardSettingsDialog from '@/core/editor/DashboardSettingsDialog.vue'
import MdiIcon from '@/core/ui/MdiIcon.vue'
import DevSidebar from '@/core/dev/DevSidebar.vue'
import SideNav from './SideNav.vue'
import BottomNav from './BottomNav.vue'
import ViewRenderer from './ViewRenderer.vue'

// Dev sidebar only in dev mode — production follows the HA language
const isDev = import.meta.env.DEV

const { t } = useI18n()
const store = useDashboardStore()
const route = useRoute()
const router = useRouter()

useTheme()

// Wall tablet / desktop: sidebar on the left. Smartphone: bottom nav.
const isWide = useMediaQuery('(min-width: 1024px)')

const activeView = computed(() => {
  const id = (route.params.viewId as string) || store.navViews[0]?.id
  return id ? store.viewById(id) : undefined
})

// In edit mode subviews appear in the nav so they can be edited
const navViews = computed(() => (store.editMode ? store.config.views : store.navViews))

function navigate(viewId: string) {
  router.push({ params: { viewId } })
}

function goBack() {
  if (window.history.length > 1) router.back()
  else if (store.navViews[0]) navigate(store.navViews[0].id)
}

// ── Kiosk: screensaver + auto-return to the first view ───────
const idleSeconds = useIdleSeconds()

const screensaverActive = computed(
  () =>
    !store.editMode &&
    store.settings.screensaverMinutes > 0 &&
    idleSeconds.value >= store.settings.screensaverMinutes * 60,
)

watch(idleSeconds, (idle) => {
  const limit = store.settings.autoReturnSeconds
  if (store.editMode || limit <= 0 || idle < limit) return
  const home = store.navViews[0]
  if (home && activeView.value?.id !== home.id) navigate(home.id)
})

// ── View management (edit mode) ──────────────────────────────
const viewDialog = ref<'closed' | 'edit' | 'new'>('closed')
const settingsOpen = ref(false)

function onViewCreated(viewId: string) {
  navigate(viewId)
}

// Undo/redo keyboard shortcuts (edit mode only)
function onKeydown(e: KeyboardEvent) {
  if (!store.editMode || !(e.ctrlKey || e.metaKey)) return
  const key = e.key.toLowerCase()
  if (key === 'z' && !e.shiftKey) {
    e.preventDefault()
    store.undo()
  } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
    e.preventDefault()
    store.redo()
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="app-shell" :class="isWide ? 'wide' : 'narrow'">
    <SideNav
      v-if="isWide"
      :views="navViews"
      :active-id="activeView?.id"
      :edit-mode="store.editMode"
      @navigate="navigate"
      @add-view="viewDialog = 'new'"
    />
    <main class="view-area" :style="activeView?.background ? { background: activeView.background } : undefined">
      <div v-if="activeView?.subview" class="subview-header">
        <button class="back-btn" :title="t('shell.back')" @click="goBack">
          <MdiIcon icon="mdi:arrow-left" :size="22" />
        </button>
        <MdiIcon v-if="activeView.icon" :icon="activeView.icon" :size="20" />
        <h1>{{ activeView.title }}</h1>
      </div>
      <div v-if="store.editMode && activeView" class="edit-toolbar">
        <MdiIcon icon="mdi:pencil" :size="16" />
        <span>{{ t('shell.editing', { title: activeView.title }) }}</span>
        <div class="toolbar-actions">
          <button
            class="toolbar-icon-btn"
            :disabled="!store.canUndo"
            :title="t('editor.undo')"
            @click="store.undo()"
          >
            <MdiIcon icon="mdi:undo" :size="18" />
          </button>
          <button
            class="toolbar-icon-btn"
            :disabled="!store.canRedo"
            :title="t('editor.redo')"
            @click="store.redo()"
          >
            <MdiIcon icon="mdi:redo" :size="18" />
          </button>
          <button class="toolbar-btn" @click="viewDialog = 'edit'">
            <MdiIcon icon="mdi:cog" :size="16" />
            {{ t('shell.viewSettings') }}
          </button>
          <button class="toolbar-btn" @click="settingsOpen = true">
            <MdiIcon icon="mdi:tune" :size="16" />
            {{ t('settings.title') }}
          </button>
        </div>
      </div>
      <ViewRenderer v-if="activeView" :view="activeView" />
      <div v-else class="empty">{{ t('shell.noView') }}</div>
    </main>
    <BottomNav
      v-if="!isWide"
      :views="navViews"
      :active-id="activeView?.id"
      :edit-mode="store.editMode"
      @navigate="navigate"
      @add-view="viewDialog = 'new'"
    />

    <EditFab />
    <DevSidebar v-if="isDev" />
    <Screensaver v-if="screensaverActive" />

    <ViewSettingsDialog
      v-if="viewDialog !== 'closed'"
      :view="viewDialog === 'edit' ? activeView : undefined"
      @close="viewDialog = 'closed'"
      @created="onViewCreated"
    />
    <DashboardSettingsDialog v-if="settingsOpen" @close="settingsOpen = false" />
  </div>
</template>

<style scoped>
.app-shell {
  height: 100%;
  display: flex;
}
.app-shell.narrow {
  flex-direction: column;
}
.view-area {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
.empty {
  display: grid;
  place-items: center;
  height: 100%;
  color: var(--text-secondary);
}
.edit-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 1200px;
  margin: 0 auto 20px;
  padding: 10px 16px;
  border-radius: 12px;
  background: var(--card-bg);
  color: var(--text-secondary);
  font-size: 14px;
}
.subview-header {
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 1200px;
  margin: 0 auto 20px;
}
.subview-header h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}
.back-btn {
  border: none;
  background: var(--card-bg);
  color: var(--text-primary);
  cursor: pointer;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
}
.back-btn:hover {
  background: var(--card-bg-active);
}
.toolbar-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
}
.toolbar-icon-btn {
  border: 1px solid var(--divider);
  border-radius: 8px;
  background: transparent;
  color: var(--text-primary);
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.toolbar-icon-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
.toolbar-icon-btn:not(:disabled):hover {
  border-color: var(--accent);
}
.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--divider);
  border-radius: 8px;
  background: transparent;
  color: var(--text-primary);
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
}
.toolbar-btn:hover {
  border-color: var(--accent);
}
</style>
