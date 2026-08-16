/**
 * All available mdi icon names, read once from the already-loaded
 * @mdi/font stylesheet (every icon is a `.mdi-<name>::before` rule).
 *
 * Parsing the live stylesheet keeps ~7400 names out of the bundle —
 * the CSS is shipped anyway because MdiIcon renders via font classes.
 */
import type { SelectOption } from './selectMenu'

let cache: string[] | null = null

function collect(): string[] {
  const names = new Set<string>()
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList
    try {
      // Cross-origin sheets throw on access — skip them
      rules = sheet.cssRules
    } catch {
      continue
    }
    for (const rule of Array.from(rules)) {
      const selector = (rule as CSSStyleRule).selectorText
      if (!selector || !selector.includes('.mdi-')) continue
      for (const match of selector.matchAll(/\.mdi-([a-z0-9-]+)::?before/g)) {
        names.add(match[1])
      }
    }
  }
  return Array.from(names).sort()
}

/** Icon names without the `mdi:` prefix, e.g. 'sofa'. Sorted, cached. */
export function mdiIconNames(): string[] {
  if (!cache) cache = collect()
  return cache
}

let optionCache: SelectOption[] | null = null

/** All icons as SelectMenu options (value/icon = 'mdi:name'). Cached. */
export function mdiIconOptions(): SelectOption[] {
  if (!optionCache) {
    optionCache = mdiIconNames().map((name) => ({
      value: `mdi:${name}`,
      label: name,
      icon: `mdi:${name}`,
    }))
  }
  return optionCache
}
