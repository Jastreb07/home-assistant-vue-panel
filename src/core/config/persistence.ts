/** Dashboard persistence through the authenticated Vue Panel integration API. */
import { getConnection } from '@/core/ha'
import type { DashboardConfig } from './types'

interface HomeAssistantCommandError {
  code?: string
  message?: string
}

export interface DashboardExport {
  filename: string
  document: DashboardConfig
}

export function isRevisionConflict(error: unknown): error is HomeAssistantCommandError {
  return typeof error === 'object' && error !== null && 'code' in error
    && (error as HomeAssistantCommandError).code === 'revision_conflict'
}

export async function loadRemote(dashboardName: string): Promise<DashboardConfig> {
  const connection = getConnection()
  if (!connection) throw new Error('No Home Assistant connection is available.')
  return connection.sendMessagePromise<DashboardConfig>({
    type: 'vue_panel/dashboard/get',
    dashboard_name: dashboardName,
  })
}

export async function saveRemote(
  dashboardName: string,
  config: DashboardConfig,
): Promise<DashboardConfig> {
  const connection = getConnection()
  if (!connection) throw new Error('No Home Assistant connection is available.')
  const document = JSON.parse(JSON.stringify(config)) as DashboardConfig
  return connection.sendMessagePromise<DashboardConfig>({
    type: 'vue_panel/dashboard/save',
    dashboard_name: dashboardName,
    expected_revision: config.revision,
    document,
  })
}

export async function exportRemote(dashboardName: string): Promise<DashboardExport> {
  const connection = getConnection()
  if (!connection) throw new Error('No Home Assistant connection is available.')
  return connection.sendMessagePromise<DashboardExport>({
    type: 'vue_panel/dashboard/export',
    dashboard_name: dashboardName,
  })
}

export async function importRemote(
  dashboardName: string,
  document: DashboardConfig,
  expectedRevision: number,
): Promise<DashboardConfig> {
  const connection = getConnection()
  if (!connection) throw new Error('No Home Assistant connection is available.')
  return connection.sendMessagePromise<DashboardConfig>({
    type: 'vue_panel/dashboard/import',
    dashboard_name: dashboardName,
    expected_revision: expectedRevision,
    document: JSON.parse(JSON.stringify(document)) as DashboardConfig,
  })
}
