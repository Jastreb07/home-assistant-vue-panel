import { defineStore } from 'pinia'
import type {
  BarConfig,
  BarEntry,
  BarPosition,
  BarSlot,
  CardConfig,
  DashboardConfig,
  DashboardSettings,
  SectionConfig,
  ViewConfig,
} from './types'
import {
  exportRemote,
  importRemote,
  isRevisionConflict,
  loadRemote,
  saveRemote,
} from './persistence'
import { t } from '@/i18n'
import { choiceDialog } from '@/core/ui/dialogService'

const HISTORY_LIMIT = 50

export const defaultSettings: DashboardSettings = {
  theme: 'dark',
  uiTheme: 'default',
  screensaverMinutes: 0,
  autoReturnSeconds: 0,
}

/** Size limits per bar — the sidebar is sized in width, the others in height. */
export const barSizeLimits: Record<BarPosition, { min: number; max: number }> = {
  sidebar: { min: 160, max: 560 },
  header: { min: 40, max: 240 },
  bottom: { min: 40, max: 240 },
}

export const defaultBars: BarConfig = {
  sidebar: {
    id: 'bar-sidebar',
    size: 280,
    centerAlign: { vertical: 'start', horizontal: 'stretch' },
    // The navigation itself is a card — replaceable like any other
    slots: {
      start: [],
      center: [{ id: 'bar-sidebar-nav', type: 'vue-panel/sidebar-bar', config: {} }],
      end: [],
    },
  },
  header: {
    id: 'bar-header',
    size: 64,
    placement: 'view',
    centerAlign: { vertical: 'center', horizontal: 'center' },
    slots: { start: [], center: [], end: [] },
  },
  bottom: {
    id: 'bar-bottom',
    size: 64,
    placement: 'view',
    centerAlign: { vertical: 'center', horizontal: 'center' },
    slots: { start: [], center: [], end: [] },
  },
}

let idCounter = 0
export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${(idCounter++).toString(36)}`
}

/** Duplicate serializable card data without retaining reactive references. */
function duplicateCardConfig(card: CardConfig, prefix: string): CardConfig {
  return {
    id: newId(prefix),
    type: card.type,
    config: JSON.parse(JSON.stringify(card.config)) as Record<string, unknown>,
    css: card.css,
    size: card.size ? { ...card.size } : undefined,
  }
}

/** Normalize a hierarchical URL path; the view id remains the fallback. */
export function normalizeRoutePath(value: string): string {
  return value.split('/').map((segment) => segment.trim()).filter(Boolean).join('/')
}

export function viewPath(view: Pick<ViewConfig, 'id' | 'path'>): string {
  return normalizeRoutePath(view.path || view.id)
}

/** Turn a title into a URL segment: 'Wohnzimmer OG' → 'wohnzimmer-og'. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    // NFD splits accented letters, \p{M} then drops the accents (é → e)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Slugify every path segment while preserving the hierarchy separators. */
export function slugifyPath(value: string): string {
  return value.split('/').map(slugify).filter(Boolean).join('/')
}

function defaultConfig(): DashboardConfig {
  return {
    format: 'vue-panel-dashboard',
    formatVersion: 1,
    revision: 1,
    settings: { ...defaultSettings },
    bars: JSON.parse(JSON.stringify(defaultBars)) as BarConfig,
    views: [
      {
        id: 'overview',
        title: t('defaults.overview'),
        icon: 'mdi:home',
        path: 'overview',
        layout: 'sections',
        showSidebar: true,
        showHeader: true,
        showBottom: true,
        sections: [],
      },
    ],
  }
}

function downloadDashboard(dashboard: DashboardConfig, filename: string): void {
  const blob = new Blob([JSON.stringify(dashboard, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export const useDashboardStore = defineStore('dashboard', {
  state: () => {
    const config = defaultConfig()
    return {
      config,
      editMode: false,
      // Undo/redo: JSON snapshots of previous config states
      undoStack: [] as string[],
      redoStack: [] as string[],
      lastSnapshot: JSON.stringify(config),
      dashboardName: '',
      remoteSaveTimer: null as number | null,
      remoteSaveInFlight: false,
      remoteSavePending: false,
    }
  },
  getters: {
    viewById(state) {
      return (id: string): ViewConfig | undefined =>
        state.config.views.find((v) => v.id === id)
    },
    /** Resolve the complete router path — configured path first, id as fallback. */
    viewByRoute(state) {
      return (path: string): ViewConfig | undefined => {
        const normalized = normalizeRoutePath(path)
        return state.config.views.find((v) => viewPath(v) === normalized)
      }
    },
    settings(state): DashboardSettings {
      return { ...defaultSettings, ...state.config.settings }
    },
    bars(state): BarConfig {
      const selected = { ...defaultBars, ...state.config.bars }
      const merge = (position: BarPosition): BarEntry => ({
        ...defaultBars[position],
        ...selected[position],
        slots: { ...defaultBars[position].slots, ...selected[position]?.slots },
      })
      return { sidebar: merge('sidebar'), header: merge('header'), bottom: merge('bottom') }
    },
    canUndo(state): boolean {
      return state.undoStack.length > 0
    },
    canRedo(state): boolean {
      return state.redoStack.length > 0
    },
  },
  actions: {
    async resolveRevisionConflict() {
      const choice = await choiceDialog(t('persistence.conflictMessage'), [
        {
          value: 'copy',
          label: t('persistence.saveCopy'),
        },
        {
          value: 'reload',
          label: t('persistence.reload'),
          variant: 'primary',
        },
      ])
      if (choice === 'copy') {
        downloadDashboard(
          this.config,
          `vue-panel-unsaved-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
        )
      }
      if (choice === 'copy' || choice === 'reload') await this.syncFromRemote()
    },
    /** Persist without touching the undo history (used by undo/redo/sync). */
    persist() {
      if (!this.dashboardName) return
      if (this.remoteSaveTimer !== null) window.clearTimeout(this.remoteSaveTimer)
      this.remoteSaveTimer = window.setTimeout(() => {
        this.remoteSaveTimer = null
        this.flushRemote().catch((err) => console.warn('[vue-panel] Remote save failed:', err))
      }, 800)
    },
    /** Queue a revision-safe remote save without allowing requests to overlap. */
    async flushRemote() {
      if (!this.dashboardName) throw new Error('Dashboard persistence is not initialized.')
      if (this.remoteSaveInFlight) {
        this.remoteSavePending = true
        return
      }
      this.remoteSaveInFlight = true
      try {
        do {
          this.remoteSavePending = false
          const snapshot = JSON.parse(JSON.stringify(this.config)) as DashboardConfig
          const saved = await saveRemote(this.dashboardName, snapshot)
          const currentWithoutRevision = { ...this.config, revision: snapshot.revision }
          if (JSON.stringify(currentWithoutRevision) === JSON.stringify(snapshot)) {
            this.config = saved
          } else {
            this.config.revision = saved.revision
            this.remoteSavePending = true
          }
          this.lastSnapshot = JSON.stringify(this.config)
        } while (this.remoteSavePending)
      } catch (error) {
        this.remoteSavePending = false
        if (isRevisionConflict(error)) {
          await this.resolveRevisionConflict()
          return
        }
        throw error
      } finally {
        this.remoteSaveInFlight = false
      }
    },
    /** Record undo history and debounce persistence through the integration API. */
    save() {
      const json = JSON.stringify(this.config)
      if (json !== this.lastSnapshot) {
        this.undoStack.push(this.lastSnapshot)
        if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift()
        this.redoStack = []
        this.lastSnapshot = json
      }
      this.persist()
    },
    undo() {
      const prev = this.undoStack.pop()
      if (!prev) return
      this.redoStack.push(JSON.stringify(this.config))
      const restored = JSON.parse(prev) as DashboardConfig
      restored.revision = this.config.revision
      this.config = restored
      this.lastSnapshot = JSON.stringify(restored)
      this.persist()
    },
    redo() {
      const next = this.redoStack.pop()
      if (!next) return
      this.undoStack.push(JSON.stringify(this.config))
      const restored = JSON.parse(next) as DashboardConfig
      restored.revision = this.config.revision
      this.config = restored
      this.lastSnapshot = JSON.stringify(restored)
      this.persist()
    },
    /** Load the current dashboard file after Home Assistant supplies its connection. */
    async syncFromRemote(dashboardName?: string) {
      if (dashboardName) this.dashboardName = dashboardName
      if (!this.dashboardName) throw new Error('Dashboard name is not initialized.')
      const remote = await loadRemote(this.dashboardName)
      this.config = remote
      this.undoStack = []
      this.redoStack = []
      this.lastSnapshot = JSON.stringify(remote)
    },
    async exportDashboard() {
      if (!this.dashboardName) throw new Error('Dashboard name is not initialized.')
      return exportRemote(this.dashboardName)
    },
    async importDashboard(document: DashboardConfig) {
      if (!this.dashboardName) throw new Error('Dashboard name is not initialized.')
      try {
        const imported = await importRemote(
          this.dashboardName,
          document,
          this.config.revision,
        )
        this.config = imported
        this.undoStack = []
        this.redoStack = []
        this.lastSnapshot = JSON.stringify(imported)
      } catch (error) {
        if (isRevisionConflict(error)) {
          await this.resolveRevisionConflict()
          return
        }
        throw error
      }
    },
    disposePersistence() {
      if (this.remoteSaveTimer !== null) window.clearTimeout(this.remoteSaveTimer)
      this.remoteSaveTimer = null
      this.remoteSavePending = false
      this.dashboardName = ''
    },
    resetToDefault() {
      this.config = { ...defaultConfig(), revision: this.config.revision }
      this.save()
    },

    // ── Settings ─────────────────────────────────────────────
    updateSettings(patch: Partial<DashboardSettings>) {
      this.config.settings = { ...this.config.settings, ...patch }
      this.save()
    },
    updateSettingsAndBars(patch: Partial<DashboardSettings>, bars: BarConfig) {
      this.config.settings = { ...this.config.settings, ...patch }
      this.config.bars = bars
      this.save()
    },
    /** Persist the container settings of one bar without touching its slots. */
    setBarLayout(position: BarPosition, patch: Partial<Omit<BarEntry, 'id' | 'slots'>>) {
      const bars = this.bars
      this.config.bars = { ...bars, [position]: { ...bars[position], ...patch } }
      this.save()
    },

    // ── Bar slot cards ───────────────────────────────────────
    /**
     * Materialize one bar in `config` so its slot arrays can be mutated.
     * The merged getter may still hand out the module-level default arrays,
     * so an unmaterialized bar is deep-copied before it is written to.
     */
    barSlot(position: BarPosition, slot: BarSlot): CardConfig[] {
      const stored = this.config.bars?.[position]
      if (!stored?.slots?.[slot]) {
        const materialized = JSON.parse(JSON.stringify(this.bars[position])) as BarEntry
        this.config.bars = { ...this.config.bars, [position]: materialized }
      }
      return this.config.bars![position]!.slots[slot]
    },
    addBarCard(position: BarPosition, slot: BarSlot, card: Omit<CardConfig, 'id'>) {
      this.barSlot(position, slot).push({ ...card, id: newId('barcard') })
      this.save()
    },
    updateBarCardConfig(
      position: BarPosition,
      slot: BarSlot,
      cardId: string,
      config: Record<string, unknown>,
      css?: string,
    ) {
      const card = this.barSlot(position, slot).find((entry) => entry.id === cardId)
      if (!card) return
      card.config = config
      card.css = css
      this.save()
    },
    removeBarCard(position: BarPosition, slot: BarSlot, cardId: string) {
      const cards = this.barSlot(position, slot)
      const index = cards.findIndex((card) => card.id === cardId)
      if (index < 0) return
      cards.splice(index, 1)
      this.save()
    },
    duplicateBarCard(position: BarPosition, slot: BarSlot, cardId: string) {
      const cards = this.barSlot(position, slot)
      const index = cards.findIndex((card) => card.id === cardId)
      if (index < 0) return
      cards.splice(index + 1, 0, duplicateCardConfig(cards[index]!, 'barcard'))
      this.save()
    },
    /** Reorder within a slot or move a card between the slots of one bar. */
    moveBarCard(position: BarPosition, cardId: string, target: BarSlot, toIndex: number) {
      const slots: BarSlot[] = ['start', 'center', 'end']
      for (const slot of slots) {
        const cards = this.barSlot(position, slot)
        const index = cards.findIndex((card) => card.id === cardId)
        if (index < 0) continue
        const [card] = cards.splice(index, 1)
        const destination = this.barSlot(position, target)
        destination.splice(Math.min(toIndex, destination.length), 0, card!)
        this.save()
        return
      }
    },

    // ── Views ────────────────────────────────────────────────
    addView(view: Omit<ViewConfig, 'id'>): ViewConfig {
      const v: ViewConfig = { ...view, id: newId('view') }
      this.config.views.push(v)
      this.save()
      return v
    },
    updateView(viewId: string, patch: Partial<Omit<ViewConfig, 'id'>>) {
      const view = this.viewById(viewId)
      if (!view) return
      Object.assign(view, patch)
      this.save()
    },
    removeView(viewId: string) {
      this.config.views = this.config.views.filter((v) => v.id !== viewId)
      this.save()
    },
    moveView(viewId: string, direction: -1 | 1) {
      const views = this.config.views
      const idx = views.findIndex((v) => v.id === viewId)
      const target = idx + direction
      if (idx < 0 || target < 0 || target >= views.length) return
      const [v] = views.splice(idx, 1)
      views.splice(target, 0, v!)
      this.save()
    },

    // ── Sections ─────────────────────────────────────────────
    addSection(viewId: string): SectionConfig | undefined {
      const view = this.viewById(viewId)
      if (!view) return
      const section: SectionConfig = { id: newId('sec'), cards: [] }
      view.sections.push(section)
      this.save()
      return section
    },
    updateSection(viewId: string, sectionId: string, patch: Partial<Omit<SectionConfig, 'id' | 'cards'>>) {
      const section = this.viewById(viewId)?.sections.find((s) => s.id === sectionId)
      if (!section) return
      Object.assign(section, patch)
      this.save()
    },
    removeSection(viewId: string, sectionId: string) {
      const view = this.viewById(viewId)
      if (!view) return
      view.sections = view.sections.filter((s) => s.id !== sectionId)
      this.save()
    },
    /** Reorder sections within a view (drag handle in edit mode). */
    moveSection(viewId: string, sectionId: string, toIndex: number) {
      const view = this.viewById(viewId)
      if (!view) return
      const idx = view.sections.findIndex((s) => s.id === sectionId)
      if (idx < 0 || toIndex < 0 || idx === toIndex) return
      const [section] = view.sections.splice(idx, 1)
      view.sections.splice(Math.min(toIndex, view.sections.length), 0, section)
      this.save()
    },

    // ── Cards ────────────────────────────────────────────────
    addCard(viewId: string, sectionId: string, card: Omit<CardConfig, 'id'>) {
      const section = this.viewById(viewId)?.sections.find((s) => s.id === sectionId)
      if (!section) return
      section.cards.push({ ...card, id: newId('card') })
      this.save()
    },
    duplicateCard(viewId: string, cardId: string) {
      const view = this.viewById(viewId)
      if (!view) return
      for (const section of view.sections) {
        const index = section.cards.findIndex((card) => card.id === cardId)
        if (index < 0) continue
        section.cards.splice(index + 1, 0, duplicateCardConfig(section.cards[index]!, 'card'))
        this.save()
        return
      }
    },
    removeCard(viewId: string, cardId: string) {
      const view = this.viewById(viewId)
      if (!view) return
      for (const section of view.sections) {
        section.cards = section.cards.filter((c) => c.id !== cardId)
      }
      this.save()
    },
    updateCardConfig(viewId: string, cardId: string, config: Record<string, unknown>, css?: string) {
      const view = this.viewById(viewId)
      if (!view) return
      for (const section of view.sections) {
        const card = section.cards.find((c) => c.id === cardId)
        if (card) {
          card.config = config
          card.css = css
        }
      }
      this.save()
    },
    /** Set a card's fixed pixel size (flex layout resize handle / size tab). */
    updateCardSize(viewId: string, cardId: string, size: Partial<NonNullable<CardConfig['size']>>) {
      const view = this.viewById(viewId)
      if (!view) return
      for (const section of view.sections) {
        const card = section.cards.find((c) => c.id === cardId)
        if (card) card.size = { ...card.size, ...size }
      }
      this.save()
    },
    /** Move a card via drag & drop (within/between sections). */
    moveCard(viewId: string, cardId: string, toSectionId: string, toIndex: number) {
      const view = this.viewById(viewId)
      if (!view) return
      let card: CardConfig | undefined
      for (const section of view.sections) {
        const idx = section.cards.findIndex((c) => c.id === cardId)
        if (idx >= 0) {
          // Adjust the target index when moving backwards within the same section
          if (section.id === toSectionId && idx < toIndex) toIndex--
          card = section.cards.splice(idx, 1)[0]
          break
        }
      }
      const target = view.sections.find((s) => s.id === toSectionId)
      if (!card || !target) return
      target.cards.splice(Math.max(0, Math.min(toIndex, target.cards.length)), 0, card)
      this.save()
    },
  },
})
