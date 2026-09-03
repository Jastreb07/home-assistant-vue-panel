import type { InjectionKey, Ref } from 'vue'

/**
 * Values a popup or detail view was opened with. Cards inside the dialog read
 * them through `vuePanel.context` and may reference them in their own
 * configuration with `${key}` placeholders.
 */
export type PopupContext = Record<string, unknown>

export const popupContextKey: InjectionKey<Ref<PopupContext>> = Symbol('vue-panel-popup-context')
export const popupCloseKey: InjectionKey<() => void> = Symbol('vue-panel-popup-close')

const PLACEHOLDER = /\$\{\s*([A-Za-z0-9_]+)\s*\}/g

/**
 * Replace `${key}` references in a card configuration. A value that is nothing
 * but one placeholder keeps the context value's type; mixed text interpolates.
 */
export function resolvePlaceholders<T>(value: T, context: PopupContext): T {
  if (typeof value === 'string') return resolveString(value, context) as T
  if (Array.isArray(value)) {
    return value.map((entry) => resolvePlaceholders(entry, context)) as T
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, entry]) => [key, resolvePlaceholders(entry, context)]),
    ) as T
  }
  return value
}

function resolveString(value: string, context: PopupContext): unknown {
  const single = value.match(/^\$\{\s*([A-Za-z0-9_]+)\s*\}$/)
  if (single) return single[1]! in context ? context[single[1]!] : value
  return value.replace(PLACEHOLDER, (match, key: string) =>
    (key in context ? String(context[key] ?? '') : match))
}

/** Narrow a card's values down to the variables a detail view asked for. */
export function pickVariables(
  config: Record<string, unknown>,
  variables?: string[],
): PopupContext {
  if (!variables) return { ...config }
  return Object.fromEntries(
    variables.filter((key) => key in config).map((key) => [key, config[key]]),
  )
}
