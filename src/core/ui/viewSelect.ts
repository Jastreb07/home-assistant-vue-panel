/** One dashboard view as offered by the ViewSelectMenu. */
export interface ViewSelectOption {
  /** Stored value — the immutable view id */
  id: string
  /** Text shown in the field and the list */
  title: string
  /** Optional mdi icon, e.g. 'mdi:sofa' */
  icon?: string
  /** Hierarchical URL path, e.g. 'overview/living-room' */
  path: string
  /** Subviews have no navigation entry of their own */
  subview?: boolean
}

/** Direction of a reorder step inside the view list. */
export type ViewMoveDirection = -1 | 1

/** Nesting level of a view — 'overview/living-room' sits one level deep. */
export function viewDepth(path: string): number {
  return Math.max(0, path.split('/').filter(Boolean).length - 1)
}

/** True when another view is nested below this one. */
export function isParentView(path: string, all: ViewSelectOption[]): boolean {
  return all.some((view) => view.path !== path && view.path.startsWith(`${path}/`))
}
