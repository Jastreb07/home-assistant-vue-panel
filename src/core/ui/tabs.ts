/** One entry of a Tabs bar. */
export interface TabItem {
  /** Stored value / active id */
  value: string
  label: string
  /** Optional mdi icon, e.g. 'mdi:palette' */
  icon?: string
}
