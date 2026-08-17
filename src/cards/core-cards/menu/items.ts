/**
 * Menu items are stored flat with a depth, the way WordPress stores
 * menu_order + parent. That keeps reordering, indenting and outdenting
 * simple — nesting is derived from the depth of the preceding items.
 */
export interface MenuItem {
  id: string
  /** Shown in the menu — independent of the view title, like in WordPress */
  label: string
  icon?: string
  /** Target view; empty means a non-clickable group header */
  viewId?: string
  /** 0 = top level, max MAX_DEPTH */
  depth: number
}

export const MAX_DEPTH = 2

let counter = 0
export function newItemId(): string {
  return `mi-${Date.now().toString(36)}-${(counter++).toString(36)}`
}

/** Number of entries belonging to the item at `index` (itself + descendants). */
export function blockLength(items: MenuItem[], index: number): number {
  const depth = items[index]!.depth
  let length = 1
  while (index + length < items.length && items[index + length]!.depth > depth) length++
  return length
}

/** An item may only sit one level deeper than the item above it. */
export function maxDepthAt(items: MenuItem[], index: number): number {
  if (index === 0) return 0
  return Math.min(items[index - 1]!.depth + 1, MAX_DEPTH)
}

/** Move the item at `index` (with its children) by whole blocks. */
export function moveBlock(items: MenuItem[], index: number, direction: -1 | 1): MenuItem[] {
  const result = [...items]
  const length = blockLength(result, index)
  const block = result.splice(index, length)
  // After the splice, `index` holds the following block — nothing left to swap with
  if (direction === 1 && index >= result.length) return items
  const target =
    direction === -1
      ? findPreviousSiblingStart(result, index)
      : index + blockLength(result, index)
  if (target < 0 || target > result.length) return items
  result.splice(target, 0, ...block)
  return normalizeDepths(result)
}

/** Start index of the block directly above `index` in the already-spliced array. */
function findPreviousSiblingStart(items: MenuItem[], index: number): number {
  if (index <= 0) return -1
  let start = index - 1
  const depth = items[start]!.depth
  while (start > 0 && items[start - 1]!.depth > depth) start--
  return start
}

/** Clamp every depth so no item is more than one level below its predecessor. */
export function normalizeDepths(items: MenuItem[]): MenuItem[] {
  return items.map((item, index, all) => {
    const max = index === 0 ? 0 : Math.min(all[index - 1]!.depth + 1, MAX_DEPTH)
    return item.depth > max ? { ...item, depth: max } : item
  })
}

/** Indent/outdent an item together with its children. */
export function shiftDepth(items: MenuItem[], index: number, delta: -1 | 1): MenuItem[] {
  const current = items[index]!.depth
  const next = current + delta
  if (next < 0 || next > maxDepthAt(items, index)) return items
  const length = blockLength(items, index)
  const result = items.map((item, i) =>
    i >= index && i < index + length ? { ...item, depth: item.depth + delta } : item,
  )
  return normalizeDepths(result)
}
