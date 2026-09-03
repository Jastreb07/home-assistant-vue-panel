import { getConnection } from './connection'

interface EntityRegistryEntry {
  entity_id: string
  device_id?: string | null
  area_id?: string | null
}

interface DeviceRegistryEntry {
  id: string
  area_id?: string | null
}

interface AreaRegistryEntry {
  area_id: string
  name: string
  icon?: string | null
}

export interface EntityAreaSnapshot {
  id: string
  name: string
  icon?: string
}

/** Resolve only the requested entities to their effective HA area. */
export async function getEntityAreas(
  entityIds: string[],
): Promise<Record<string, EntityAreaSnapshot | null>> {
  const connection = getConnection()
  if (!connection) throw new Error('No Home Assistant connection is available.')

  const [entities, devices, areas] = await Promise.all([
    connection.sendMessagePromise<EntityRegistryEntry[]>({ type: 'config/entity_registry/list' }),
    connection.sendMessagePromise<DeviceRegistryEntry[]>({ type: 'config/device_registry/list' }),
    connection.sendMessagePromise<AreaRegistryEntry[]>({ type: 'config/area_registry/list' }),
  ])
  const entityById = new Map(entities.map((entry) => [entry.entity_id, entry]))
  const deviceById = new Map(devices.map((entry) => [entry.id, entry]))
  const areaById = new Map(areas.map((entry) => [entry.area_id, entry]))

  return Object.fromEntries(entityIds.map((entityId) => {
    const entity = entityById.get(entityId)
    const areaId = entity?.area_id || (entity?.device_id
      ? deviceById.get(entity.device_id)?.area_id
      : undefined)
    const area = areaId ? areaById.get(areaId) : undefined
    return [entityId, area ? {
      id: area.area_id,
      name: area.name,
      ...(area.icon ? { icon: area.icon } : {}),
    } : null]
  }))
}
