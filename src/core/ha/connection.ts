/** Home Assistant connection for the standalone dev page and production iframe. */
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

export interface VuePanelRegistrationConfig {
  dashboardName: string
  engineVersion: string
  apiVersion: number
}

export interface EmbeddedPanelContext extends VuePanelRegistrationConfig {
  language: string
  isAdmin: boolean
}

interface AuthData {
  hassUrl: string
  access_token: string
  expires: number
}

interface EmbeddedPanelMessage extends Partial<EmbeddedPanelContext>, Partial<AuthData> {
  type?: string
}

export type HaStatus = 'connecting' | 'connected' | 'auth-required' | 'error'

const entities = shallowRef<HassEntities>({})
const status = ref<HaStatus>('connecting')
const errorMessage = ref('')
const dashboardName = ref('')
const administrator = ref(false)

let connection: Connection | null = null
let developmentConnection = false
let latestAuth: AuthData | null = null
let latestContext: EmbeddedPanelContext | null = null
let authWaiters: Array<(auth: AuthData) => void> = []
let contextWaiters: Array<(context: EmbeddedPanelContext) => void> = []

function normalizeExpiry(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return Date.now() + 30 * 60_000
}

function isEmbeddedPanelMessage(value: unknown): value is EmbeddedPanelMessage {
  return typeof value === 'object' && value !== null
    && (value as EmbeddedPanelMessage).type === 'vue-panel:auth'
}

window.addEventListener('message', (event: MessageEvent) => {
  if (window.parent === window || event.source !== window.parent || event.origin !== location.origin) return
  if (!isEmbeddedPanelMessage(event.data)) return

  const message = event.data
  if (!message.access_token || !message.dashboardName || !message.engineVersion) return

  latestAuth = {
    hassUrl: message.hassUrl || location.origin,
    access_token: message.access_token,
    expires: normalizeExpiry(message.expires),
  }
  latestContext = {
    dashboardName: message.dashboardName,
    engineVersion: message.engineVersion,
    apiVersion: Number(message.apiVersion) || 1,
    language: message.language || '',
    isAdmin: message.isAdmin === true,
  }
  administrator.value = latestContext.isAdmin
  setPanelRegistration(latestContext)

  for (const resolve of authWaiters) resolve(latestAuth)
  authWaiters = []
  for (const resolve of contextWaiters) resolve(latestContext)
  contextWaiters = []
})

function waitForAuthMessage(): Promise<AuthData> {
  if (latestAuth && latestAuth.expires > Date.now()) return Promise.resolve(latestAuth)
  return new Promise((resolve) => authWaiters.push(resolve))
}

function waitForEmbeddedContext(): Promise<EmbeddedPanelContext> {
  if (latestContext) return Promise.resolve(latestContext)
  window.parent.postMessage({ type: 'vue-panel:request-context' }, location.origin)
  return new Promise((resolve) => contextWaiters.push(resolve))
}

function buildAuth(initial: AuthData): Auth {
  latestAuth = initial
  return {
    get data() {
      return latestAuth
    },
    get wsUrl() {
      return `${latestAuth!.hassUrl.replace(/^http/, 'ws')}/api/websocket`
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
  } as unknown as Auth
}

function subscribeToHomeAssistant(activeConnection: Connection): void {
  connection = activeConnection
  subscribeEntities(activeConnection, (updatedEntities) => {
    entities.value = updatedEntities
  })
  activeConnection.addEventListener('ready', () => {
    status.value = 'connected'
  })
  activeConnection.addEventListener('disconnected', () => {
    status.value = 'connecting'
  })
  errorMessage.value = ''
  status.value = 'connected'
}

/** Store immutable panel registration data supplied by the iframe loader. */
export function setPanelRegistration(config: VuePanelRegistrationConfig): void {
  if (!config?.dashboardName) throw new Error('Vue Panel registration has no dashboard name.')
  dashboardName.value = config.dashboardName
}

export function getDashboardName(): string {
  if (!dashboardName.value) throw new Error('Vue Panel dashboard name is not initialized.')
  return dashboardName.value
}

/** Establish an authenticated connection inside the production iframe. */
export async function connectForEmbeddedPanel(): Promise<EmbeddedPanelContext> {
  if (window.parent === window) {
    status.value = 'auth-required'
    throw new Error('The production Vue Panel engine must run inside its loader iframe.')
  }

  try {
    const context = await waitForEmbeddedContext()
    if (!connection) subscribeToHomeAssistant(await createConnection({ auth: buildAuth(await waitForAuthMessage()) }))
    developmentConnection = false
    return context
  } catch (error) {
    status.value = 'error'
    errorMessage.value = error instanceof Error ? error.message : String(error)
    throw error
  }
}

/** Establish a separate connection only for the standalone Vite development page. */
export async function connectForDevelopment(): Promise<void> {
  if (connection) return
  const hassUrl = (import.meta.env.VITE_HASS_URL as string | undefined) || location.origin
  const accessToken = import.meta.env.VITE_HASS_TOKEN as string | undefined
  if (!accessToken) {
    status.value = 'auth-required'
    throw new Error('VITE_HASS_TOKEN is required for standalone development.')
  }

  const auth = buildAuth({
    hassUrl,
    access_token: accessToken,
    expires: Date.now() + 365 * 24 * 3600_000,
  })

  try {
    subscribeToHomeAssistant(await createConnection({ auth }))
    developmentConnection = true
  } catch (error) {
    status.value = 'error'
    errorMessage.value = error instanceof Error ? error.message : String(error)
    throw error
  }
}

export function configureDevelopmentDashboard(): void {
  setPanelRegistration({
    dashboardName: (import.meta.env.VITE_DASHBOARD_NAME as string | undefined) || 'vue-panel-dev',
    engineVersion: 'development',
    apiVersion: 1,
  })
}

export function announceEmbeddedPanelReady(engineVersion: string): void {
  if (window.parent === window) return
  window.parent.postMessage({ type: 'vue-panel:ready', engineVersion }, location.origin)
}

export function getConnection(): Connection | null {
  return connection
}

export function isDevelopmentConnection(): boolean {
  return developmentConnection
}

export function useEntities() {
  return readonly(entities)
}

export function useHaStatus() {
  return { status: readonly(status), errorMessage: readonly(errorMessage) }
}

export function useHaAdministrator() {
  return readonly(administrator)
}

export async function callService(
  domain: string,
  service: string,
  data?: Record<string, unknown>,
  target?: HassServiceTarget,
): Promise<void> {
  if (!connection) throw new Error('No Home Assistant connection is available.')
  await haCallService(connection, domain, service, data, target)
}
