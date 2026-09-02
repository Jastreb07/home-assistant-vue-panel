const PANEL_STORAGE_KEY = 'vue-panel:scale'
const VIEW_STORAGE_KEY = 'vue-panel:view-scale'

export const PANEL_SCALE_MIN = 50
export const PANEL_SCALE_MAX = 200
export const PANEL_SCALE_STEP = 1
export const DEFAULT_PANEL_SCALE = 100

export function normalizePanelScale(value: unknown): number {
  if (value === null || value === undefined || value === '') return DEFAULT_PANEL_SCALE
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return DEFAULT_PANEL_SCALE
  const stepped = Math.round(parsed / PANEL_SCALE_STEP) * PANEL_SCALE_STEP
  return Math.min(PANEL_SCALE_MAX, Math.max(PANEL_SCALE_MIN, stepped))
}

export function readPanelScale(): number {
  return normalizePanelScale(localStorage.getItem(PANEL_STORAGE_KEY))
}

/** CSS zoom mirrors browser zoom by scaling layout, fixed UI and breakpoints together. */
export function applyPanelScale(value: unknown): number {
  const scale = normalizePanelScale(value)
  document.documentElement.style.setProperty('zoom', String(scale / 100))
  return scale
}

export function savePanelScale(value: unknown): number {
  const scale = applyPanelScale(value)
  localStorage.setItem(PANEL_STORAGE_KEY, String(scale))
  return scale
}

export function readViewScale(): number {
  return normalizePanelScale(localStorage.getItem(VIEW_STORAGE_KEY))
}

export function applyViewScale(value: unknown): number {
  const scale = normalizePanelScale(value)
  document.documentElement.style.setProperty('--vp-view-scale', String(scale / 100))
  return scale
}

export function saveViewScale(value: unknown): number {
  const scale = applyViewScale(value)
  localStorage.setItem(VIEW_STORAGE_KEY, String(scale))
  return scale
}

export function initializePanelScale(): void {
  applyPanelScale(readPanelScale())
  applyViewScale(readViewScale())
}
