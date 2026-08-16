import { defineStore } from 'pinia'
import type {
  CardConfig,
  DashboardConfig,
  DashboardSettings,
  SectionConfig,
  ViewConfig,
} from './types'
import { loadRemote, saveRemote } from './persistence'
import { t } from '@/i18n'

const STORAGE_KEY = 'vue-panel:dashboard'
const HISTORY_LIMIT = 50

export const defaultSettings: DashboardSettings = {
  theme: 'dark',
  uiTheme: 'default',
  screensaverMinutes: 0,
  autoReturnSeconds: 0,
}

let idCounter = 0
export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${(idCounter++).toString(36)}`
}

function defaultConfig(): DashboardConfig {
  return {
    version: 1,
    views: [
      {
        id: 'home',
        title: t('defaults.overview'),
        icon: 'mdi:home',
        layout: 'sections',
        sections: [
          {
            id: 'sec-start',
            title: t('defaults.start'),
            cards: [
              { id: 'card-clock', type: 'clock', config: {} },
              { id: 'card-light-demo', type: 'light', config: { entity: '' } },
            ],
          },
        ],
      },
    ],
  }
}

function loadLocal(): DashboardConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as DashboardConfig
  } catch (err) {
    console.warn('[vue-panel] Could not load stored config:', err)
  }
  return defaultConfig()
}

let remoteSaveTimer: ReturnType<typeof setTimeout> | null = null

export const useDashboardStore = defineStore('dashboard', {
  state: () => {
    const config = loadLocal()
    return {
      config,
      editMode: false,
      // Undo/redo: JSON snapshots of previous config states
      undoStack: [] as string[],
      redoStack: [] as string[],
      lastSnapshot: JSON.stringify(config),
    }
  },
  getters: {
    /** Views for the navigation (excluding subviews) */
    navViews(state): ViewConfig[] {
      return state.config.views.filter((v) => !v.subview)
    },
    viewById(state) {
      return (id: string): ViewConfig | undefined =>
        state.config.views.find((v) => v.id === id)
    },
    settings(state): DashboardSettings {
      return { ...defaultSettings, ...state.config.settings }
    },
    canUndo(state): boolean {
      return state.undoStack.length > 0
    },
    canRedo(state): boolean {
      return state.redoStack.length > 0
    },
  },
  actions: {
    /** Persist without touching the undo history (used by undo/redo/sync). */
    persist() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config))
      if (remoteSaveTimer) clearTimeout(remoteSaveTimer)
      remoteSaveTimer = setTimeout(() => {
        saveRemote(this.config).catch((err) =>
          console.warn('[vue-panel] Remote save failed:', err),
        )
      }, 800)
    },
    /** localStorage immediately, remote (HA .storage) debounced. Records undo history. */
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
      this.config = JSON.parse(prev) as DashboardConfig
      this.lastSnapshot = prev
      this.persist()
    },
    redo() {
      const next = this.redoStack.pop()
      if (!next) return
      this.undoStack.push(JSON.stringify(this.config))
      this.config = JSON.parse(next) as DashboardConfig
      this.lastSnapshot = next
      this.persist()
    },
    /** After connecting: the server-side config takes precedence over localStorage. */
    async syncFromRemote() {
      try {
        const remote = await loadRemote()
        if (remote && Array.isArray(remote.views)) {
          this.config = remote
          this.undoStack = []
          this.redoStack = []
          this.lastSnapshot = JSON.stringify(remote)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(remote))
        } else {
          // First device: upload the local/default config as the starting point
          await saveRemote(this.config)
        }
      } catch (err) {
        console.warn('[vue-panel] Remote sync failed:', err)
      }
    },
    resetToDefault() {
      this.config = defaultConfig()
      this.save()
    },

    // ── Settings ─────────────────────────────────────────────
    updateSettings(patch: Partial<DashboardSettings>) {
      this.config.settings = { ...this.config.settings, ...patch }
      this.save()
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
    addSection(viewId: string, title?: string): SectionConfig | undefined {
      const view = this.viewById(viewId)
      if (!view) return
      const section: SectionConfig = { id: newId('sec'), title, cards: [] }
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

    // ── Cards ────────────────────────────────────────────────
    addCard(viewId: string, sectionId: string, card: Omit<CardConfig, 'id'>) {
      const section = this.viewById(viewId)?.sections.find((s) => s.id === sectionId)
      if (!section) return
      section.cards.push({ ...card, id: newId('card') })
      this.save()
    },
    removeCard(viewId: string, cardId: string) {
      const view = this.viewById(viewId)
      if (!view) return
      for (const section of view.sections) {
        section.cards = section.cards.filter((c) => c.id !== cardId)
      }
      this.save()
    },
    updateCardConfig(viewId: string, cardId: string, config: Record<string, unknown>) {
      const view = this.viewById(viewId)
      if (!view) return
      for (const section of view.sections) {
        const card = section.cards.find((c) => c.id === cardId)
        if (card) card.config = config
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
