/**
 * Conditional variables: a card may hide one of its settings until another
 * setting of the same card has a certain value — for example the attribute
 * name that only matters once "show attribute" is on.
 */
export type ConditionValue = string | number | boolean

export interface VisibilityCondition {
  /** Key of the variable this condition looks at */
  key: string
  equals?: ConditionValue
  in?: ConditionValue[]
  not?: ConditionValue
}

export type VisibleIf = VisibilityCondition | VisibilityCondition[]

/** Compare loosely enough that "true" from a stored string still matches. */
function sameValue(value: unknown, expected: ConditionValue): boolean {
  if (typeof expected === 'boolean') return value === true ? expected : !expected
  return String(value ?? '') === String(expected)
}

function matches(condition: VisibilityCondition, values: Record<string, unknown>): boolean {
  const value = values[condition.key]
  if (condition.in) return condition.in.some((option) => sameValue(value, option))
  if (condition.not !== undefined) return !sameValue(value, condition.not)
  if (condition.equals !== undefined) return sameValue(value, condition.equals)
  return true
}

/**
 * A field without conditions is always shown; with several conditions all of
 * them have to hold. Unknown keys simply never match, so a broken condition
 * hides its field instead of silently ignoring the rule.
 */
export function isVisible(
  visibleIf: VisibleIf | undefined,
  values: Record<string, unknown>,
): boolean {
  if (!visibleIf) return true
  const conditions = Array.isArray(visibleIf) ? visibleIf : [visibleIf]
  return conditions.every((condition) => matches(condition, values))
}
