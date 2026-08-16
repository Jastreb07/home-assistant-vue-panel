/**
 * Central Home Assistant WebSocket connection.
 *
 * Auth sources (in this order):
 * 1. Dev mode: VITE_HASS_URL + VITE_HASS_TOKEN from .env.local
 * 2. Production: postMessage `vue-panel:auth` from loader.js (panel iframe)
 */
import {
  createConnection,
  subscribeEntities,
  callService as haCallService,
  type Auth,
  type Connection,
  type HassEntities,
  type HassServiceTarget,
} from 'home-assistant-js-websocket'
import { readonly, ref, shallowRef } from 'vue'

export interface AuthData {
  hassUrl: string
  access_token: string
  expires: number
}

export type HaStatus = 'connecting' | 'connected' | 'auth-required' | 'error'

const entities = shallowRef<HassEntities>({})
const status = ref<HaStatus>('connecting')
const errorMessage = ref('')

let connection: Connection | null = null
let latestAuth: AuthData | null = null
let authWaiters: Array<(d: AuthData) => void> = []

// Receive auth updates from loader.js (including token refreshes)
window.addEventListener('message', (ev: MessageEvent) => {
  if (ev.origin !== location.origin) return
  const msg = ev.data
  if (!msg || msg.type !== 'vue-panel:auth' || !msg.access_token) return
  latestAuth = {
    hassUrl: msg.hassUrl || location.origin,
    access_token: msg.access_token,
    expires: msg.expires || Date.now() + 30 * 60_000,
  }
  authWaiters.forEach((resolve) => resolve(latestAuth!))
  authWaiters = []
})

function waitForAuthMessage(): Promise<AuthData> {
  if (latestAuth && latestAuth.expires > Date.now()) return Promise.resolve(latestAuth)
  return new Promise((resolve) => authWaiters.push(resolve))
}

async function resolveInitialAuth(): Promise<AuthData> {
  const devUrl = import.meta.env.VITE_HASS_URL as string | undefined
  const devToken = import.meta.env.VITE_HASS_TOKEN as string | undefined
  if (devToken) {
    return {
      hassUrl: devUrl || location.origin,
      access_token: devToken,
      // Long-lived token — practically never expires
      expires: Date.now() + 365 * 24 * 3600_000,
    }
  }
  if (window.parent !== window) {
    return waitForAuthMessage()
  }
  status.value = 'auth-required'
  throw new Error('No auth source: neither .env.local (dev) nor loader.js iframe (production).')
}

/** Auth object understood by home-assistant-js-websocket, supporting token refresh via the loader. */
function buildAuth(initial: AuthData): Auth {
  latestAuth = initial
  const authLike = {
    get data() {
      return latestAuth
    },
    get wsUrl() {
      return latestAuth!.hassUrl.replace(/^http/, 'ws') + '/api/websocket'
    },
    get accessToken() {
      return latestAuth!.access_token
    },
    get expired() {
      return Date.now() > latestAuth!.expires - 10_000
    },
    async refreshAccessToken() {
      latestAuth = await waitForAuthMessage()
    },
  }
  return authLike as unknown as Auth
}

/** Establish the connection and subscribe to entity updates. Call once from main.ts. */
export async function connect(): Promise<void> {
  if (connection) return
  try {
    const auth = buildAuth(await resolveInitialAuth())
    connection = await createConnection({ auth })
    subscribeEntities(connection, (ents) => {
      entities.value = ents
    })
    connection.addEventListener('ready', () => (status.value = 'connected'))
    connection.addEventListener('disconnected', () => (status.value = 'connecting'))
    status.value = 'connected'
  } catch (err) {
    if (status.value !== 'auth-required') {
      status.value = 'error'
      errorMessage.value = err instanceof Error ? err.message : String(err)
    }
    throw err
  }
}

export function getConnection(): Connection | null {
  return connection
}

/** Reactive access to all entity states (replaced wholesale on every update). */
export function useEntities() {
  return readonly(entities)
}

export function useHaStatus() {
  return { status: readonly(status), errorMessage: readonly(errorMessage) }
}

/** Call a service; throws when no connection is established yet. */
export async function callService(
  domain: string,
  service: string,
  data?: Record<string, unknown>,
  target?: HassServiceTarget,
): Promise<void> {
  if (!connection) throw new Error('No HA connection')
  await haCallService(connection, domain, service, data, target)
}
