import { ref } from 'vue'

/**
 * Bridge for rendering native Home Assistant (Lovelace) cards.
 *
 * The engine runs in an iframe, but HA's `hui-*` elements are only defined in
 * the surrounding Home Assistant document. So the engine renders a placeholder
 * and asks the loader in the parent window to create the real card and lay it
 * over that placeholder. This module owns the message protocol; the visual
 * placeholder lives in HassCardHost.vue.
 */

export interface HassCardRect {
  left: number
  top: number
  width: number
  height: number
  /** Hidden placeholders (scrolled away, collapsed) park the overlay card */
  visible: boolean
  /**
   * Visible part of the placeholder, as insets from its own edges. The card
   * is painted outside the engine's document, so it cannot be clipped by the
   * scroll containers and dialogs the placeholder sits in — the loader
   * applies these insets instead.
   */
  clip: { top: number; right: number; bottom: number; left: number }
}

/**
 * Measure a placeholder together with the region its ancestors leave visible.
 * Every ancestor that clips its content (a scrolling list, a dialog body)
 * narrows the area the overlay may paint in.
 */
export function measureOverlay(element: HTMLElement, hidden = false): HassCardRect {
  const box = element.getBoundingClientRect()
  let left = 0
  let top = 0
  let right = window.innerWidth
  let bottom = window.innerHeight

  for (let node = element.parentElement; node; node = node.parentElement) {
    const style = getComputedStyle(node)
    const clips = style.overflow !== 'visible'
      || style.overflowX !== 'visible'
      || style.overflowY !== 'visible'
    if (!clips) continue
    const area = node.getBoundingClientRect()
    left = Math.max(left, area.left)
    top = Math.max(top, area.top)
    right = Math.min(right, area.right)
    bottom = Math.min(bottom, area.bottom)
  }

  const clip = {
    left: Math.max(0, left - box.left),
    top: Math.max(0, top - box.top),
    right: Math.max(0, box.right - right),
    bottom: Math.max(0, box.bottom - bottom),
  }
  const onScreen = !hidden
    && element.isConnected
    && box.width > 0
    && box.height > 0
    && clip.left + clip.right < box.width
    && clip.top + clip.bottom < box.height

  return {
    left: box.left,
    top: box.top,
    width: box.width,
    height: box.height,
    visible: onScreen && !isCovered(element, box, clip),
    clip,
  }
}

/**
 * Dialogs and popups appear without any scroll or resize event, so overlay
 * cards would keep sitting on top of them. One shared observer watches the
 * document for mounted/unmounted UI and lets every host re-measure.
 */
const recheckListeners = new Set<() => void>()
let recheckObserver: MutationObserver | null = null
let recheckFrame = 0

function notifyRecheck() {
  if (recheckFrame) return
  recheckFrame = requestAnimationFrame(() => {
    recheckFrame = 0
    for (const listener of recheckListeners) listener()
  })
}

export function onOverlayRecheck(listener: () => void): () => void {
  recheckListeners.add(listener)
  if (!recheckObserver) {
    recheckObserver = new MutationObserver(notifyRecheck)
    recheckObserver.observe(document.body, { childList: true, subtree: true })
  }
  return () => {
    recheckListeners.delete(listener)
    if (recheckListeners.size) return
    recheckObserver?.disconnect()
    recheckObserver = null
  }
}

/**
 * Whether something in the engine is drawn on top of the placeholder — a
 * dialog, a popup, an open menu. The card itself is painted above the whole
 * iframe, so it would cover that UI instead of the other way round; a hit
 * test in the middle of the still-visible part decides who is really on top.
 */
function isCovered(
  element: HTMLElement,
  box: DOMRect,
  clip: { top: number; right: number; bottom: number; left: number },
): boolean {
  const x = (box.left + clip.left + (box.right - clip.right)) / 2
  const y = (box.top + clip.top + (box.bottom - clip.bottom)) / 2
  const top = document.elementFromPoint(x, y)
  if (!top) return false
  return !element.contains(top) && !top.contains(element)
}

/** One entry of Home Assistant's `window.customCards` registry. */
export interface HassCustomCard {
  type: string
  name?: string
  description?: string
  preview?: boolean
}

function parentWindow(): Window | null {
  return window.parent !== window ? window.parent : null
}

function post(message: Record<string, unknown>): void {
  parentWindow()?.postMessage(message, location.origin)
}

export function createHassCard(id: string, config: Record<string, unknown>): void {
  post({ type: 'vue-panel:hass-card-create', id, config: JSON.parse(JSON.stringify(config)) })
}

export function updateHassCard(id: string, config: Record<string, unknown>): void {
  post({ type: 'vue-panel:hass-card-config', id, config: JSON.parse(JSON.stringify(config)) })
}

export function placeHassCard(id: string, rect: HassCardRect): void {
  post({ type: 'vue-panel:hass-card-rect', id, rect })
}

export function destroyHassCard(id: string): void {
  post({ type: 'vue-panel:hass-card-destroy', id })
}

/**
 * Ask for Home Assistant's own settings form for a card. The loader answers
 * with a readiness message — cards without a visual editor report `false`,
 * and the caller falls back to the raw JSON editor.
 */
export function createHassEditor(id: string, config: Record<string, unknown>): void {
  post({ type: 'vue-panel:hass-editor-create', id, config: JSON.parse(JSON.stringify(config)) })
}

type EditorListener = {
  onConfig: (config: Record<string, unknown>) => void
  onReady: (available: boolean) => void
}

const editorListeners = new Map<string, EditorListener>()

export function watchHassEditor(id: string, listener: EditorListener): () => void {
  editorListeners.set(id, listener)
  return () => editorListeners.delete(id)
}

/** True while the engine is embedded and can reach the loader at all. */
export const hassCardsAvailable = window.parent !== window

// ── Custom card catalog (HACS cards register in `window.customCards`) ──
const customCards = ref<HassCustomCard[]>([])
let requested = false

window.addEventListener('message', (event: MessageEvent) => {
  if (event.origin !== location.origin || event.source !== window.parent) return
  const data = event.data as {
    type?: string
    cards?: HassCustomCard[]
    id?: string
    available?: boolean
    config?: Record<string, unknown>
  }
  if (data?.type === 'vue-panel:hass-custom-cards') {
    customCards.value = Array.isArray(data.cards)
      ? data.cards.filter((card) => typeof card?.type === 'string' && card.type)
      : []
    return
  }
  if (data?.type === 'vue-panel:hass-editor-ready' && data.id) {
    editorListeners.get(data.id)?.onReady(data.available === true)
    return
  }
  if (data?.type === 'vue-panel:hass-editor-config' && data.id && data.config) {
    editorListeners.get(data.id)?.onConfig(data.config)
  }
})

/**
 * Custom cards installed in Home Assistant (Mushroom, Bubble Card, …).
 * The list arrives asynchronously, so the picker simply renders what it has.
 */
export function useHassCustomCards() {
  if (!requested && hassCardsAvailable) {
    requested = true
    post({ type: 'vue-panel:hass-custom-cards-request' })
  }
  return customCards
}
