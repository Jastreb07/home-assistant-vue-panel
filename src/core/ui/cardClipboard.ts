import { ref } from 'vue'
import type { CardConfig, SectionConfig } from '@/core/config/types'

const CLIPBOARD_KEY = 'vue-panel:card-clipboard'
const SECTION_CLIPBOARD_KEY = 'vue-panel:section-clipboard'

export interface CardClipboardPayload {
  type: 'vue-panel/card'
  card: Omit<CardConfig, 'id'>
}

/** Read and validate the app-local card clipboard. */
export function readCardFromClipboard(): Omit<CardConfig, 'id'> | null {
  try {
    const raw = localStorage.getItem(CLIPBOARD_KEY)
    if (!raw) return null
    const payload = JSON.parse(raw) as Partial<CardClipboardPayload>
    const card = payload.card
    if (
      payload.type !== 'vue-panel/card' ||
      !card ||
      typeof card.type !== 'string' ||
      typeof card.config !== 'object' ||
      card.config === null
    ) return null
    return JSON.parse(JSON.stringify(card)) as Omit<CardConfig, 'id'>
  } catch {
    return null
  }
}

/** Keep a dashboard-card copy available inside the app and in the system clipboard. */
export async function copyCardToClipboard(card: CardConfig): Promise<void> {
  const payload: CardClipboardPayload = {
    type: 'vue-panel/card',
    card: {
      type: card.type,
      config: JSON.parse(JSON.stringify(card.config)) as Record<string, unknown>,
      css: card.css,
      visibility: card.visibility ? { ...card.visibility } : undefined,
      size: card.size ? { ...card.size } : undefined,
    },
  }
  const serialized = JSON.stringify(payload, null, 2)

  localStorage.setItem(CLIPBOARD_KEY, serialized)
  try {
    await navigator.clipboard.writeText(serialized)
  } catch {
    // The internal clipboard remains available when browser permissions deny access.
  }
}

// ── Sections ─────────────────────────────────────────────────

export interface SectionClipboardPayload {
  type: 'vue-panel/section'
  section: Omit<SectionConfig, 'id'>
}

function readSectionFromStorage(): Omit<SectionConfig, 'id'> | null {
  try {
    const raw = localStorage.getItem(SECTION_CLIPBOARD_KEY)
    if (!raw) return null
    const payload = JSON.parse(raw) as Partial<SectionClipboardPayload>
    const section = payload.section
    if (payload.type !== 'vue-panel/section' || !section || !Array.isArray(section.cards)) {
      return null
    }
    return JSON.parse(JSON.stringify(section)) as Omit<SectionConfig, 'id'>
  } catch {
    return null
  }
}

/** Reactive view of the app-local section clipboard (paste tiles watch this). */
export const sectionClipboard = ref<Omit<SectionConfig, 'id'> | null>(readSectionFromStorage())

/** Keep a section copy available inside the app and in the system clipboard. */
export async function copySectionToClipboard(section: SectionConfig): Promise<void> {
  const clone = JSON.parse(JSON.stringify(section)) as Partial<SectionConfig>
  delete clone.id
  const payload: SectionClipboardPayload = {
    type: 'vue-panel/section',
    section: clone as Omit<SectionConfig, 'id'>,
  }
  const serialized = JSON.stringify(payload, null, 2)

  localStorage.setItem(SECTION_CLIPBOARD_KEY, serialized)
  sectionClipboard.value = JSON.parse(JSON.stringify(payload.section)) as Omit<SectionConfig, 'id'>
  try {
    await navigator.clipboard.writeText(serialized)
  } catch {
    // The internal clipboard remains available when browser permissions deny access.
  }
}
