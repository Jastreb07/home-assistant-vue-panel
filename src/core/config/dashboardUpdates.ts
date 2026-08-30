import { readonly, ref } from 'vue'
import { getConnection } from '@/core/ha'
import { clientId } from './persistence'

/**
 * Watches for the same dashboard being edited somewhere else — a second
 * browser, another tablet — so this panel can offer to pick up the change
 * instead of quietly showing a stale layout.
 *
 * The backend fires `vue_panel_dashboard_updated` after every write and
 * echoes the writer's `client_id`. Comparing that (rather than only the
 * revision) is what reliably keeps the editing device from prompting
 * itself: its own save response and the broadcast race each other, so a
 * revision comparison alone can go either way.
 */

interface DashboardUpdatedEvent {
  data?: {
    dashboard_name?: string
    revision?: number
    client_id?: string | null
  }
}

const outdated = ref(false)
let started = false

export function useDashboardOutdated() {
  return readonly(outdated)
}

/**
 * Begin listening. `currentRevision` is read on every event rather than
 * captured, so a reload or a later save keeps the comparison honest.
 */
export function watchDashboardUpdates(
  dashboardName: () => string,
  currentRevision: () => number,
): void {
  if (started) return
  const connection = getConnection()
  if (!connection) return
  started = true

  void connection.subscribeEvents<DashboardUpdatedEvent>((event) => {
    const data = event?.data
    if (!data || data.dashboard_name !== dashboardName()) return
    // Our own write — the local state already holds it.
    if (data.client_id && data.client_id === clientId) return
    if (Number(data.revision ?? 0) <= currentRevision()) return
    outdated.value = true
  }, 'vue_panel_dashboard_updated')
}
