/** Shared value type of the BoxInput control (padding / margin / any four-sided value). */

export type BoxUnit = 'px' | '%' | 'em' | 'rem'

export const boxUnits: BoxUnit[] = ['px', '%', 'em', 'rem']

/** The four sides in CSS shorthand order. */
export type BoxSide = 'top' | 'right' | 'bottom' | 'left'

export const boxSides: BoxSide[] = ['top', 'right', 'bottom', 'left']

export interface BoxValue {
  top?: number
  right?: number
  bottom?: number
  left?: number
  unit?: BoxUnit
  /** All four sides are edited together (chain button) */
  linked?: boolean
}

/** True when no side carries a value — such a box produces no CSS at all. */
export function isBoxEmpty(box?: BoxValue): boolean {
  return !box || boxSides.every((s) => box[s] === undefined || box[s] === null)
}

/**
 * CSS shorthand for a box value, e.g. '8px 0px 8px 0px'.
 * Returns undefined when nothing is set, so callers can omit the property.
 */
export function boxToCss(box?: BoxValue): string | undefined {
  if (isBoxEmpty(box)) return undefined
  const unit = box!.unit ?? 'px'
  return boxSides.map((s) => `${box![s] ?? 0}${unit}`).join(' ')
}

/** Drop the box from the config when it has no effect (keeps the JSON small). */
export function normalizeBox(box?: BoxValue): BoxValue | undefined {
  return isBoxEmpty(box) ? undefined : box
}
