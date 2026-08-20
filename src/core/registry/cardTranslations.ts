import type { CardTranslations } from './portableCardTypes'

/** Every technical translation key of a card starts with this prefix. */
export const TRANSLATION_PREFIX = 'translation.'

/** English is the last resort whenever a card declares no fallback. */
export const DEFAULT_TRANSLATION_FALLBACK = 'en'

export const emptyCardTranslations: CardTranslations = {
  fallback: DEFAULT_TRANSLATION_FALLBACK,
  languages: {},
}

export function isTranslationKey(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(TRANSLATION_PREFIX)
}

/** Accepts BCP-47-style tags such as `en`, `de` or `pt-BR`. */
export function isCardLanguage(value: string): boolean {
  return /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(value)
}

/**
 * Readable name of a language tag in the panel's own language, so the card
 * editor can list languages it knows nothing about.
 */
export function cardLanguageName(language: string, locale: string): string {
  try {
    const names = new Intl.DisplayNames([locale], { type: 'language' })
    return names.of(language) ?? language
  } catch {
    return language
  }
}

/**
 * Resolve one key against a card's catalogs: the active language first, then
 * the card's fallback language, then English. A key that is untranslated
 * everywhere — including one translated to an empty string — is shown as the
 * technical key itself, so gaps are obvious instead of silently blank.
 */
export function cardTranslation(
  translations: CardTranslations | undefined,
  key: string,
  locale: string,
): string {
  const languages = translations?.languages ?? {}
  const order = [
    locale,
    // A card translated as "pt-BR" still answers a panel running in "pt"
    ...Object.keys(languages).filter((language) => language.split('-')[0] === locale),
    translations?.fallback ?? DEFAULT_TRANSLATION_FALLBACK,
    DEFAULT_TRANSLATION_FALLBACK,
  ]
  for (const language of order) {
    const text = languages[language]?.[key]
    if (typeof text === 'string' && text !== '') return text
  }
  return key
}

/**
 * Card-authored text: `translation.*` values go through the card catalogs,
 * anything else is literal text kept as the author typed it.
 */
export function cardText(
  translations: CardTranslations | undefined,
  value: string,
  locale: string,
): string {
  return isTranslationKey(value) ? cardTranslation(translations, value, locale) : value
}
