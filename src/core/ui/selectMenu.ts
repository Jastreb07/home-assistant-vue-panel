/** One entry of a SelectMenu. */
export interface SelectOption {
  /** Stored value */
  value: string
  /** Text shown in the field and the dropdown */
  label: string
  /** Optional mdi icon, e.g. 'mdi:sofa' */
  icon?: string
  /**
   * Heading this option is listed under. Options without one are listed
   * first, ungrouped; the group order follows their first appearance in the
   * option list, so callers decide it by ordering their options.
   */
  group?: string
}
