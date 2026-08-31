/**
 * Colour helpers for the ColorPicker: parsing and formatting of the two
 * notations a card may store — hex (`#rgb`, `#rrggbb`, `#rrggbbaa`) and
 * functional rgb (`rgb(r g b)`, `rgba(r, g, b, a)`) — plus the HSV
 * conversions the picker's saturation/value area works in.
 */

export interface Rgba {
  r: number
  g: number
  b: number
  /** 0 to 1 */
  a: number
}

export type ColorFormat = 'hex' | 'rgb'

export const defaultColor: Rgba = { r: 255, g: 255, b: 255, a: 1 }

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function byte(value: number): number {
  return clamp(Math.round(value), 0, 255)
}

/** Parses hex and rgb()/rgba() notation — returns null for anything else. */
export function parseColor(input: string): Rgba | null {
  const value = String(input ?? '').trim()
  if (!value) return null

  const hex = value.replace(/^#/, '')
  if (/^[0-9a-f]+$/i.test(hex) && [3, 4, 6, 8].includes(hex.length)) {
    const wide = hex.length <= 4
    const part = (index: number) => {
      const raw = wide
        ? hex[index]!.repeat(2)
        : hex.slice(index * 2, index * 2 + 2)
      return parseInt(raw, 16)
    }
    const hasAlpha = hex.length === 4 || hex.length === 8
    return {
      r: part(0),
      g: part(1),
      b: part(2),
      a: hasAlpha ? Number((part(3) / 255).toFixed(3)) : 1,
    }
  }

  // rgb(255 0 0 / 50%) and rgba(255, 0, 0, 0.5) both parse the same way
  const fn = /^rgba?\(([^)]+)\)$/i.exec(value)
  if (fn) {
    const parts = fn[1]!.split(/[\s,/]+/).filter(Boolean)
    if (parts.length < 3) return null
    const channel = (raw: string) =>
      raw.endsWith('%') ? (parseFloat(raw) / 100) * 255 : parseFloat(raw)
    const alphaRaw = parts[3]
    const alpha = alphaRaw === undefined
      ? 1
      : alphaRaw.endsWith('%')
        ? parseFloat(alphaRaw) / 100
        : parseFloat(alphaRaw)
    const rgba = {
      r: byte(channel(parts[0]!)),
      g: byte(channel(parts[1]!)),
      b: byte(channel(parts[2]!)),
      a: clamp(Number.isFinite(alpha) ? alpha : 1, 0, 1),
    }
    return Number.isFinite(rgba.r) && Number.isFinite(rgba.g) && Number.isFinite(rgba.b)
      ? rgba
      : null
  }
  return null
}

export function formatColor(color: Rgba, format: ColorFormat): string {
  if (format === 'rgb') {
    const { r, g, b } = color
    return color.a >= 1
      ? `rgb(${byte(r)}, ${byte(g)}, ${byte(b)})`
      : `rgba(${byte(r)}, ${byte(g)}, ${byte(b)}, ${Number(color.a.toFixed(3))})`
  }
  const hex = (value: number) => byte(value).toString(16).padStart(2, '0')
  const base = `#${hex(color.r)}${hex(color.g)}${hex(color.b)}`
  return color.a >= 1 ? base : `${base}${hex(color.a * 255)}`
}

/** CSS value for previews — always keeps the alpha channel. */
export function toCss(color: Rgba): string {
  return `rgba(${byte(color.r)}, ${byte(color.g)}, ${byte(color.b)}, ${Number(color.a.toFixed(3))})`
}

export interface Hsv {
  /** 0 to 360 */
  h: number
  /** 0 to 1 */
  s: number
  /** 0 to 1 */
  v: number
}

export function rgbToHsv(color: Rgba): Hsv {
  const r = color.r / 255
  const g = color.g / 255
  const b = color.b / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  let h = 0
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6
    else if (max === g) h = (b - r) / delta + 2
    else h = (r - g) / delta + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max === 0 ? 0 : delta / max, v: max }
}

export function hsvToRgb(hsv: Hsv, alpha = 1): Rgba {
  const h = ((hsv.h % 360) + 360) % 360
  const s = clamp(hsv.s, 0, 1)
  const v = clamp(hsv.v, 0, 1)
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  const sector = Math.floor(h / 60) % 6
  const [r, g, b] = (
    [
      [c, x, 0],
      [x, c, 0],
      [0, c, x],
      [0, x, c],
      [x, 0, c],
      [c, 0, x],
    ] as const
  )[sector]!
  return { r: byte((r + m) * 255), g: byte((g + m) * 255), b: byte((b + m) * 255), a: clamp(alpha, 0, 1) }
}
