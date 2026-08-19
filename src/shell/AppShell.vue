<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDashboardStore, viewPath } from '@/core/config/dashboardStore'
import { useTheme } from '@/core/composables/useTheme'
import { useHaAdministrator } from '@/core/ha'
import { navigatePanel, usePanelRoutePath } from '@/core/router/panelNavigation'
import { useIdleSeconds } from '@/core/kiosk/useIdleSeconds'
import Screensaver from '@/core/kiosk/Screensaver.vue'
import EditFab from '@/core/editor/EditFab.vue'
import ViewSettingsDialog from '@/core/editor/ViewSettingsDialog.vue'
import DashboardSettingsDialog from '@/core/editor/DashboardSettingsDialog.vue'
import CustomCardDialog from '@/core/custom-cards/CustomCardDialog.vue'
import MdiIcon from '@/core/ui/MdiIcon.vue'
import BaseSelectMenu from '@/core/ui/BaseSelectMenu.vue'
import DevSidebar from '@/core/dev/DevSidebar.vue'
import ShellBarHost from './ShellBarHost.vue'
import ViewRenderer from './ViewRenderer.vue'

const { t } = useI18n()
const store = useDashboardStore()
const routePath = usePanelRoutePath()
const isHaAdministrator = useHaAdministrator()
const showDevSidebar = computed(() => import.meta.env.DEV || isHaAdministrator.value)

useTheme()

const views = computed(() => store.config.views)

const activeView = computed(() => {
  const path = routePath.value
  return path ? store.viewByRoute(path) : views.value[0]
})

/** All pages as options for the edit toolbar picker. */
const viewOptions = computed(() =>
  views.value.map((v) => ({ value: v.id, label: v.title, icon: v.icon })),
)

// Per-view bar visibility — every bar but the right sidebar is on by default.
const showSidebarLeft = computed(() => activeView.value?.showSidebarLeft !== false)
const showSidebarRight = computed(() => activeView.value?.showSidebarRight === true)
const showHeader = computed(() => activeView.value?.showHeader !== false)
const showBottom = computed(() => activeView.value?.showBottom !== false)
const headerInViewArea = computed(() => store.bars.header.placement === 'view')
const bottomInViewArea = computed(() => store.bars.bottom.placement === 'view')

/** Views are addressed by id everywhere — the URL uses their path. */
function navigate(viewId: string) {
  const view = store.viewById(viewId)
  if (view) navigatePanel(viewPath(view))
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
  const home = views.value[0]
  if (home && activeView.value?.id !== home.id) navigate(home.id)
})

// ── View management (edit mode) ──────────────────────────────
const viewDialog = ref<'closed' | 'edit' | 'new' | 'duplicate'>('closed')
const settingsOpen = ref(false)
const customCardDialogOpen = ref(false)

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
  <div class="app-shell">
    <ShellBarHost v-if="showHeader && !headerInViewArea" position="header" />

    <div class="shell-body">
      <!-- The global bars are engine components fed by the dashboard store. -->
      <ShellBarHost v-if="showSidebarLeft" position="sidebar-left" />
      <div class="view-column">
        <ShellBarHost v-if="showHeader && headerInViewArea" position="header" />
        <main class="view-area" :style="activeView?.background ? { background: activeView.background } : undefined">
          <div class="view-scroll">
            <div v-if="store.editMode && activeView" class="edit-toolbar">
              <MdiIcon icon="mdi:pencil" :size="16" />
              <div class="view-picker">
                <BaseSelectMenu
                  :model-value="activeView.id"
                  :options="viewOptions"
                  size="sm"
                  searchable
                  @update:model-value="navigate($event)"
                />
              </div>
              <button
                class="toolbar-icon-btn"
                :title="t('shell.newView')"
                @click="viewDialog = 'new'"
              >
                <MdiIcon icon="mdi:plus" :size="18" />
              </button>
              <button
                class="toolbar-icon-btn"
                :title="t('shell.duplicateView')"
                @click="viewDialog = 'duplicate'"
              >
                <MdiIcon icon="mdi:content-copy" :size="17" />
              </button>
              <button
                class="toolbar-icon-btn custom-card-button"
                :title="t('shell.newCustomCard')"
                @click="customCardDialogOpen = true"
              >
                <MdiIcon icon="mdi:code-tags" :size="18" />
              </button>
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
          </div>
          <EditFab />
        </main>
        <ShellBarHost v-if="showBottom && bottomInViewArea" position="bottom" />
      </div>
      <ShellBarHost v-if="showSidebarRight" position="sidebar-right" />
    </div>

    <ShellBarHost v-if="showBottom && !bottomInViewArea" position="bottom" />

    <DevSidebar v-if="showDevSidebar" />
    <Screensaver v-if="screensaverActive" />

    <ViewSettingsDialog
      v-if="viewDialog !== 'closed'"
      :view="viewDialog === 'edit' || viewDialog === 'duplicate' ? activeView : undefined"
      :duplicate="viewDialog === 'duplicate'"
      @close="viewDialog = 'closed'"
      @navigate="onViewCreated"
    />
    <DashboardSettingsDialog v-if="settingsOpen" @close="settingsOpen = false" />
    <CustomCardDialog
      v-if="customCardDialogOpen"
      @close="customCardDialogOpen = false"
    />
  </div>
</template>

<style scoped>
.app-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
}
/* Sidebar + view area sit below the header bar */
.shell-body {
  flex: 1;
  display: flex;
  min-height: 0;
}
.view-area {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.view-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
.view-scroll {
  height: 100%;
  box-sizing: border-box;
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
.view-picker {
  min-width: 200px;
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
.custom-card-button {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 42%, var(--divider));
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
