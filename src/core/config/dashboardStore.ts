import { defineStore } from 'pinia'
import type {
  CardConfig,
  DashboardConfig,
  DashboardSettings,
  HeaderConfig,
  HeaderSlot,
  NavConfig,
  NavSlot,
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

export const defaultNav: NavConfig = {
  // The view navigation itself is a card — replaceable like any other
  slots: {
    top: [{ id: 'navcard-clock', type: 'clock', config: {} }],
    center: [{ id: 'navcard-menu', type: 'menu', config: {} }],
    bottom: [],
  },
  width: 280,
  centerAlign: { vertical: 'start', horizontal: 'stretch' },
}

/** Config written before the sidebar had slots kept a flat `cards` array. */
interface LegacyNav {
  cards?: CardConfig[]
  cardsPosition?: 'top' | 'bottom'
}

function resolveSlots(raw: Partial<NavConfig> & LegacyNav): Record<NavSlot, CardConfig[]> {
  if (raw.slots) {
    const slots = raw.slots
    return { top: slots.top ?? [], center: slots.center ?? [], bottom: slots.bottom ?? [] }
  }
  if (raw.cards?.length) {
    const target: NavSlot = raw.cardsPosition === 'top' ? 'top' : 'bottom'
    return { ...defaultNav.slots, [target]: raw.cards }
  }
  return defaultNav.slots
}

export const defaultHeader: HeaderConfig = {
  slots: { left: [{ id: 'hdrcard-clock', type: 'clock', config: {} }], center: [], right: [] },
  height: 64,
  centerAlign: { vertical: 'center', horizontal: 'center' },
}

function resolveHeaderSlots(raw: Partial<HeaderConfig>): Record<HeaderSlot, CardConfig[]> {
  const slots = raw.slots
  if (!slots) return defaultHeader.slots
  return { left: slots.left ?? [], center: slots.center ?? [], right: slots.right ?? [] }
}

let idCounter = 0
export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${(idCounter++).toString(36)}`
}

/** URL segment of a view — the id is the fallback for views without a path. */
export function viewPath(view: Pick<ViewConfig, 'id' | 'path'>): string {
  return view.path || view.id
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
            cards: [
              { id: 'card-title', type: 'section-title', config: { title: t('defaults.start') } },
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
    viewById(state) {
      return (id: string): ViewConfig | undefined =>
        state.config.views.find((v) => v.id === id)
    },
    /** Resolve the URL segment from the router — path first, id as fallback. */
    viewByRoute(state) {
      return (segment: string): ViewConfig | undefined =>
        state.config.views.find((v) => viewPath(v) === segment)
    },
    settings(state): DashboardSettings {
      return { ...defaultSettings, ...state.config.settings }
    },
    nav(state): NavConfig {
      const raw = state.config.nav ?? {}
      return {
        ...defaultNav,
        ...raw,
        slots: resolveSlots(raw),
        centerAlign: { ...defaultNav.centerAlign, ...raw.centerAlign },
      }
    },
    header(state): HeaderConfig {
      const raw = state.config.header ?? {}
      return {
        ...defaultHeader,
        ...raw,
        slots: resolveHeaderSlots(raw),
        centerAlign: { ...defaultHeader.centerAlign, ...raw.centerAlign },
      }
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

    // ── Navigation ───────────────────────────────────────────
    /** Write a full nav object — the getter merges defaults and migrates. */
    setNav(patch: Partial<NavConfig>) {
      this.config.nav = { ...this.nav, ...patch }
      this.save()
    },
    updateNav(patch: Partial<Omit<NavConfig, 'slots'>>) {
      this.setNav(patch)
    },
    addNavCard(slot: NavSlot, card: Omit<CardConfig, 'id'>) {
      const slots = { ...this.nav.slots }
      slots[slot] = [...slots[slot], { ...card, id: newId('navcard') }]
      this.setNav({ slots })
    },
    removeNavCard(slot: NavSlot, cardId: string) {
      const slots = { ...this.nav.slots }
      slots[slot] = slots[slot].filter((c) => c.id !== cardId)
      this.setNav({ slots })
    },
    updateNavCardConfig(slot: NavSlot, cardId: string, config: Record<string, unknown>, css?: string) {
      const slots = { ...this.nav.slots }
      slots[slot] = slots[slot].map((c) => (c.id === cardId ? { ...c, config, css } : c))
      this.setNav({ slots })
    },
    /** Move a nav card within or between slots (drag & drop). */
    moveNavCard(cardId: string, toSlot: NavSlot, toIndex: number) {
      const slots: Record<NavSlot, CardConfig[]> = {
        top: [...this.nav.slots.top],
        center: [...this.nav.slots.center],
        bottom: [...this.nav.slots.bottom],
      }
      let card: CardConfig | undefined
      for (const key of Object.keys(slots) as NavSlot[]) {
        const idx = slots[key].findIndex((c) => c.id === cardId)
        if (idx < 0) continue
        // Adjust the target when moving backwards within the same slot
        if (key === toSlot && idx < toIndex) toIndex--
        card = slots[key].splice(idx, 1)[0]
        break
      }
      if (!card) return
      slots[toSlot].splice(Math.max(0, Math.min(toIndex, slots[toSlot].length)), 0, card)
      this.setNav({ slots })
    },

    // ── Header bar ───────────────────────────────────────────
    /** Write a full header object — the getter merges defaults. */
    setHeader(patch: Partial<HeaderConfig>) {
      this.config.header = { ...this.header, ...patch }
      this.save()
    },
    updateHeader(patch: Partial<Omit<HeaderConfig, 'slots'>>) {
      this.setHeader(patch)
    },
    addHeaderCard(slot: HeaderSlot, card: Omit<CardConfig, 'id'>) {
      const slots = { ...this.header.slots }
      slots[slot] = [...slots[slot], { ...card, id: newId('hdrcard') }]
      this.setHeader({ slots })
    },
    removeHeaderCard(slot: HeaderSlot, cardId: string) {
      const slots = { ...this.header.slots }
      slots[slot] = slots[slot].filter((c) => c.id !== cardId)
      this.setHeader({ slots })
    },
    updateHeaderCardConfig(
      slot: HeaderSlot,
      cardId: string,
      config: Record<string, unknown>,
      css?: string,
    ) {
      const slots = { ...this.header.slots }
      slots[slot] = slots[slot].map((c) => (c.id === cardId ? { ...c, config, css } : c))
      this.setHeader({ slots })
    },
    /** Move a header card within or between slots (drag & drop). */
    moveHeaderCard(cardId: string, toSlot: HeaderSlot, toIndex: number) {
      const slots: Record<HeaderSlot, CardConfig[]> = {
        left: [...this.header.slots.left],
        center: [...this.header.slots.center],
        right: [...this.header.slots.right],
      }
      let card: CardConfig | undefined
      for (const key of Object.keys(slots) as HeaderSlot[]) {
        const idx = slots[key].findIndex((c) => c.id === cardId)
        if (idx < 0) continue
        // Adjust the target when moving backwards within the same slot
        if (key === toSlot && idx < toIndex) toIndex--
        card = slots[key].splice(idx, 1)[0]
        break
      }
      if (!card) return
      slots[toSlot].splice(Math.max(0, Math.min(toIndex, slots[toSlot].length)), 0, card)
      this.setHeader({ slots })
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
