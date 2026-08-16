import { createI18n } from 'vue-i18n'
import en from './locales/en'
import de from './locales/de'

const STORAGE_KEY = 'vue-panel:locale'

export type AppLocale = 'en' | 'de'
export const SUPPORTED_LOCALES: AppLocale[] = ['en', 'de']

function detectLocale(): AppLocale {
  const saved = localStorage.getItem(STORAGE_KEY) as AppLocale | null
  if (saved && SUPPORTED_LOCALES.includes(saved)) return saved
  const browser = navigator.language.slice(0, 2) as AppLocale
  return SUPPORTED_LOCALES.includes(browser) ? browser : 'en'
}

export const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: 'en',
  messages: { en, de },
})

/** Apply the HA UI language (production). Always takes priority. */
function applyHaLocale(language: string): void {
  const short = language.slice(0, 2) as AppLocale
  if (!SUPPORTED_LOCALES.includes(short)) return
  i18n.global.locale.value = short
  document.documentElement.lang = short
}

// In production the loader.js forwards the HA language with every auth message
window.addEventListener('message', (ev: MessageEvent) => {
  if (ev.origin !== location.origin) return
  const msg = ev.data
  if (!msg || msg.type !== 'vue-panel:auth' || !msg.language) return
  applyHaLocale(msg.language)
})

/** Manual switching — only offered in dev mode (HA language wins in production). */
export function setLocale(locale: AppLocale): void {
  i18n.global.locale.value = locale
  localStorage.setItem(STORAGE_KEY, locale)
  document.documentElement.lang = locale
}

/** Translate outside of components (stores, defaults). */
export function t(key: string, params?: Record<string, unknown>): string {
  return params ? i18n.global.t(key, params) : i18n.global.t(key)
}
