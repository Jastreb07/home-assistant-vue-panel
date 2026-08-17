import type { CardConfig } from '@/core/config/types'

const CLIPBOARD_KEY = 'vue-panel:card-clipboard'

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
