/**
 * Server-side persistence of the dashboard config via the HA WebSocket API
 * (frontend/set_user_data). Stored per HA user in .storage —
 * no YAML, no custom integration, available on all devices.
 */
import { getConnection } from '../ha'
import type { DashboardConfig } from './types'

const USER_DATA_KEY = 'vue-panel-dashboard'

export async function loadRemote(): Promise<DashboardConfig | null> {
  const conn = getConnection()
  if (!conn) return null
  const res = await conn.sendMessagePromise<{ value: DashboardConfig | null }>({
    type: 'frontend/get_user_data',
    key: USER_DATA_KEY,
  })
  return res?.value ?? null
}

export async function saveRemote(config: DashboardConfig): Promise<void> {
  const conn = getConnection()
  if (!conn) return
  await conn.sendMessagePromise({
    type: 'frontend/set_user_data',
    key: USER_DATA_KEY,
    value: JSON.parse(JSON.stringify(config)),
  })
}
