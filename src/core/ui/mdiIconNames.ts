/**
 * All available mdi icon names, read once from the already-loaded
 * @mdi/font stylesheet (every icon is a `.mdi-<name>::before` rule).
 *
 * Parsing the live stylesheet keeps ~7400 names out of the bundle —
 * the CSS is shipped anyway because MdiIcon renders via font classes.
 */
import type { SelectOption } from './selectMenu'

let cache: string[] | null = null
let glyphCache: Map<string, string> | null = null

function glyphFromContent(content: string): string | undefined {
  const escapedCodePoint = content.match(/\\([0-9a-f]+)/i)?.[1]
  if (escapedCodePoint) return String.fromCodePoint(Number.parseInt(escapedCodePoint, 16))
  const quotedGlyph = content.match(/^["'](.+)["']$/s)?.[1]
  return quotedGlyph || undefined
}

function collect(): string[] {
  const names = new Set<string>()
  const glyphs = new Map<string, string>()
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
      const content = (rule as CSSStyleRule).style?.content ?? ''
      const glyph = glyphFromContent(content)
      for (const match of selector.matchAll(/\.mdi-([a-z0-9-]+)::?before/g)) {
        names.add(match[1])
        if (glyph) glyphs.set(match[1], glyph)
      }
    }
  }
  glyphCache = glyphs
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

/** Render an arbitrary MDI icon to a sandbox-safe transparent PNG data URL. */
export async function mdiIconDataUrl(icon: string, size = 64, color = '#000000'): Promise<string> {
  if (!cache || !glyphCache) cache = collect()
  const name = icon.replace(/^mdi:/, '')
  const glyph = glyphCache?.get(name)
  if (!glyph) return ''

  const canvasSize = Math.min(256, Math.max(16, Math.round(size)))
  const fontSize = canvasSize * 0.82
  const font = `${fontSize}px "Material Design Icons"`
  await document.fonts.load(font, glyph)
  await document.fonts.ready
  const canvas = document.createElement('canvas')
  canvas.width = canvasSize
  canvas.height = canvasSize
  const context = canvas.getContext('2d')
  if (!context) return ''
  context.font = font
  context.fillStyle = color
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(glyph, canvasSize / 2, canvasSize / 2)
  return canvas.toDataURL('image/png')
}
