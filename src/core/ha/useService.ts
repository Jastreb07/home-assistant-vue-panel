import type { HassServiceTarget } from 'home-assistant-js-websocket'
import { callService } from './connection'

/**
 * Call services of a domain.
 *
 *   const { call, toggle, turnOn, turnOff } = useService('light')
 *   toggle(config.entity)
 *   call('turn_on', { brightness_pct: 50 }, { entity_id: config.entity })
 */
export function useService(domain: string) {
  return {
    call: (
      service: string,
      data?: Record<string, unknown>,
      target?: HassServiceTarget,
    ) => callService(domain, service, data, target),
    toggle: (entityId: string) =>
      callService(domain, 'toggle', undefined, { entity_id: entityId }),
    turnOn: (entityId: string, data?: Record<string, unknown>) =>
      callService(domain, 'turn_on', data, { entity_id: entityId }),
    turnOff: (entityId: string) =>
      callService(domain, 'turn_off', undefined, { entity_id: entityId }),
  }
}
