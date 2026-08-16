import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from 'vue'
import type { HassEntity } from 'home-assistant-js-websocket'
import { useEntities } from './connection'

/**
 * Reactive access to a single entity.
 * Updates live on every state change coming over the WebSocket.
 *
 *   const light = useEntity(() => props.config.entity)
 *   light.value?.state  // 'on' | 'off' | ...
 */
export function useEntity(
  entityId: MaybeRefOrGetter<string | undefined>,
): ComputedRef<HassEntity | undefined> {
  const entities = useEntities()
  return computed(() => {
    const id = toValue(entityId)
    return id ? entities.value[id] : undefined
  })
}
