<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDashboardStore, viewPath } from '@/core/config/dashboardStore'
import { useTheme } from '@/core/composables/useTheme'
import { useHaAdministrator } from '@/core/ha'
import { navigatePanel, usePanelRoutePath } from '@/core/router/panelNavigation'
import { reportSidebarHidden } from '@/core/router/hostSidebar'
import { useIdleSeconds } from '@/core/kiosk/useIdleSeconds'
import { useViewportWidth } from '@/core/composables/useViewportWidth'
import { matchesViewport } from '@/core/ui/responsiveCss'
import type { BarPosition } from '@/core/config/types'
import Screensaver from '@/core/kiosk/Screensaver.vue'
import EditFab from '@/core/editor/EditFab.vue'
import ViewSettingsDialog from '@/core/editor/ViewSettingsDialog.vue'
import DashboardSettingsDialog from '@/core/editor/DashboardSettingsDialog.vue'
import PopupManagerDialog from '@/core/editor/PopupManagerDialog.vue'
import PopupHost from '@/core/popups/PopupHost.vue'
import { closeAllPopups, openPopup } from '@/core/popups/popupService'
import CustomCardDialog from '@/core/custom-cards/CustomCardDialog.vue'
import MdiIcon from '@/core/ui/MdiIcon.vue'
import BaseViewSelectMenu from '@/core/ui/BaseViewSelectMenu.vue'
import type { ViewMoveDirection, ViewSelectOption } from '@/core/ui/viewSelect'
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

/** The first view is the dashboard default — empty or unknown URLs land there. */
const defaultView = computed(() => views.value[0])

const activeView = computed(() => {
  const path = routePath.value
  return (path ? store.viewByRoute(path) : undefined) ?? defaultView.value
})

/**
 * The URL always carries the path of the active view, so every view stays
 * directly addressable and reloads or deep links keep working. Rewriting waits
 * for the loaded dashboard — otherwise a deep link would be dropped while the
 * placeholder config is still in place.
 */
watch(
  [routePath, activeView, () => store.loaded],
  () => {
    if (!store.loaded) return
    const view = activeView.value
    if (!view) return
    const path = viewPath(view)
    if (routePath.value !== path) navigatePanel(path, { replace: true })
  },
  { immediate: true },
)

/** A dialog always belongs to the view it was opened from. */
watch(activeView, (view, previous) => {
  if (view?.id !== previous?.id) closeAllPopups()
})

/** All pages as options for the edit toolbar picker. */
const viewOptions = computed<ViewSelectOption[]>(() =>
  views.value.map((v) => ({
    id: v.id,
    title: v.title,
    icon: v.icon,
    path: viewPath(v),
    subview: v.subview,
  })),
)

/** Reordering the views also changes which one is the default view. */
function moveView(viewId: string, direction: ViewMoveDirection) {
  store.moveView(viewId, direction)
}

/** Drag & drop in the view dropdown drops a view at an absolute position. */
function reorderView(viewId: string, toIndex: number) {
  store.moveViewTo(viewId, toIndex)
}

// Per-bar device visibility — configured in the dashboard settings.
const viewportWidth = useViewportWidth()
function fitsViewport(position: BarPosition): boolean {
  return matchesViewport(store.bars[position].visibility, viewportWidth.value)
}

/**
 * A 'global' bar is switched on or off dashboard-wide from the settings
 * dialog — a view's own show/hide toggle is hidden and ignored for it. A
 * 'perView' bar has no such master switch: each view decides for itself via
 * `viewFlag`, `defaultShown` being its fallback when unset.
 */
function barVisible(position: BarPosition, viewFlag: boolean | undefined, defaultShown: boolean): boolean {
  const bar = store.bars[position]
  const allowed = bar.scope === 'perView' ? (viewFlag ?? defaultShown) : bar.enabled !== false
  return allowed && fitsViewport(position)
}

// Per-view bar visibility — every bar but the right sidebar is on by default.
const showSidebarLeft = computed(() => barVisible('sidebar-left', activeView.value?.showSidebarLeft, true))
const showSidebarRight = computed(() => barVisible('sidebar-right', activeView.value?.showSidebarRight, false))
const showHeader = computed(() => barVisible('header', activeView.value?.showHeader, true))
const showBottom = computed(() => barVisible('bottom', activeView.value?.showBottom, true))
const headerInViewArea = computed(() => store.bars.header.placement === 'view')
const bottomInViewArea = computed(() => store.bars.bottom.placement === 'view')

/**
 * Animating the view switch. Off when the setting says so, and always off
 * when the system asks for reduced motion — that preference outranks a
 * dashboard default.
 */
const prefersReducedMotion = typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
const viewTransition = computed(
  () => store.settings.viewTransition !== false && !prefersReducedMotion,
)

/**
 * Home Assistant's own sidebar. Edit mode always keeps it reachable —
 * otherwise a kiosk dashboard could lock the user out of the rest of HA.
 */
watchEffect(() => {
  reportSidebarHidden(store.settings.hideHaSidebar === true && !store.editMode)
})

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
const popupManagerOpen = ref(false)

/** Editing a popup hides the manager and brings it back when the popup closes. */
function editPopupCards(popupId: string) {
  store.editMode = true
  popupManagerOpen.value = false
  openPopup(popupId, {}, { onClose: () => { popupManagerOpen.value = true } })
}

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
    <ShellBarHost v-if="showHeader && !headerInViewArea" position="header" :view-id="activeView?.id" />

    <div class="shell-body">
      <!-- The global bars are engine components fed by the dashboard store. -->
      <ShellBarHost v-if="showSidebarLeft" position="sidebar-left" :view-id="activeView?.id" />
      <div class="view-column">
        <ShellBarHost v-if="showHeader && headerInViewArea" position="header" :view-id="activeView?.id" />
        <main class="view-area" :style="activeView?.background ? { background: activeView.background } : undefined">
          <div class="view-scroll">
            <div v-if="store.editMode && activeView" class="edit-toolbar">
              <MdiIcon icon="mdi:pencil" :size="16" />
              <div class="view-picker">
                <BaseViewSelectMenu
                  :model-value="activeView.id"
                  :views="viewOptions"
                  size="sm"
                  searchable
                  @update:model-value="navigate($event)"
                  @move="moveView"
                  @reorder="reorderView"
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
              <button
                class="toolbar-icon-btn"
                :title="t('shell.managePopups')"
                @click="popupManagerOpen = true"
              >
                <MdiIcon icon="mdi:card-text-outline" :size="18" />
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
            <!--
              Keyed on the view so the animation runs on a real view switch,
              not on every edit. `:css` off skips the classes entirely, which
              is what the setting (and a reduced-motion preference) turns off.
            -->
            <Transition name="view-switch" mode="out-in" :css="viewTransition">
              <ViewRenderer v-if="activeView" :key="activeView.id" :view="activeView" />
              <div v-else class="empty">{{ t('shell.noView') }}</div>
            </Transition>
          </div>
          <EditFab />
        </main>
        <ShellBarHost v-if="showBottom && bottomInViewArea" position="bottom" :view-id="activeView?.id" />
      </div>
      <ShellBarHost v-if="showSidebarRight" position="sidebar-right" :view-id="activeView?.id" />
    </div>

    <ShellBarHost v-if="showBottom && !bottomInViewArea" position="bottom" :view-id="activeView?.id" />

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
    <PopupManagerDialog
      v-if="popupManagerOpen"
      @close="popupManagerOpen = false"
      @edit-cards="editPopupCards"
    />
    <!-- Custom popups and detail views live above the whole panel -->
    <PopupHost />
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
/*
 * View switch: the old view fades out, the new one fades in slightly offset
 * (`mode="out-in"`, so they never overlap and the scroll position cannot
 * jump). Leaving is quicker than entering — waiting for a slow fade-out is
 * what makes a transition feel sluggish.
 */
.view-switch-enter-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}
.view-switch-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.view-switch-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.view-switch-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
.edit-toolbar {
  /* Own stacking context above the cards so the view dropdown can never be
     overpainted by card edit overlays, whatever z-index they use. */
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 1200px;
  margin: 0 auto 50px;
  padding: 10px 16px;
  border-radius: 12px;
  background: var(--card-bg);
  color: var(--text-secondary);
  font-size: 14px;
}
.view-picker {
  min-width: 260px;
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
