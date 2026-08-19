<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PortableCardCapability } from '@/core/registry/portableCardTypes'
import { callService, useEntities } from '@/core/ha'
import { useDashboardStore, viewPath } from '@/core/config/dashboardStore'
import { navigatePanel, usePanelRoutePath } from '@/core/router/panelNavigation'
import { useI18n } from 'vue-i18n'
import { mdiIconDataUrl } from '@/core/ui/mdiIconNames'
import { runtimeId } from '@/core/utils/runtimeId'

const props = withDefaults(defineProps<{
  definition: SandboxCardDefinition
  config?: Record<string, unknown>
  preview?: boolean
}>(), { config: () => ({}) })
const emit = defineEmits<{
  action: [action: string, detail: Record<string, unknown>]
}>()

const MESSAGE_NAMESPACE = 'vue-panel:card'
const SANDBOX_API_VERSION = 1
interface SandboxCardDefinition {
  html: string
  css: string
  javascript: string
  capabilities: PortableCardCapability[]
}
const THEME_VARIABLES = [
  '--bg', '--card-bg', '--card-bg-active', '--card-radius', '--card-shadow',
  '--text-primary', '--text-secondary', '--text-on-active', '--accent', '--divider',
  '--nav-bg', '--nav-item-hover', '--nav-item-active',
]

const iframe = ref<HTMLIFrameElement | null>(null)
const channel = runtimeId('custom')
const entities = useEntities()
const store = useDashboardStore()
const routePath = usePanelRoutePath()
const { locale } = useI18n()
const subscriptions = new Map<string, string>()
const navigationSubscriptions = new Set<string>()
const renderDefinition = ref<SandboxCardDefinition>({ ...props.definition })
const runtimeError = ref('')
let renderTimer: ReturnType<typeof setTimeout> | null = null

function encode(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function scriptSafe(value: string): string {
  return value.replace(/<\/script/gi, '<\\/script')
}

function currentTheme(): Record<string, string> {
  const styles = getComputedStyle(document.documentElement)
  return Object.fromEntries(THEME_VARIABLES.map((name) => [name, styles.getPropertyValue(name).trim()]))
}

function messageSnapshot(message: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(message)) as Record<string, unknown>
}

const srcdoc = computed(() => {
  const definition = renderDefinition.value
  const bootstrap = `
    const namespace = ${JSON.stringify(MESSAGE_NAMESPACE)};
    const apiVersion = ${SANDBOX_API_VERSION};
    const channel = ${JSON.stringify(channel)};
    const pending = new Map();
    const listeners = new Map();
    let sequence = 0;
    const send = (message) => parent.postMessage({ namespace, apiVersion, channel, ...message }, '*');
    const request = (action, payload = {}) => new Promise((resolve, reject) => {
      const requestId = String(++sequence);
      pending.set(requestId, { resolve, reject });
      send({ kind: 'request', requestId, action, payload });
    });
    addEventListener('message', (event) => {
      const message = event.data;
      if (!message || message.namespace !== namespace || message.apiVersion !== apiVersion || message.channel !== channel) return;
      if (message.kind === 'response') {
        const task = pending.get(message.requestId);
        if (!task) return;
        pending.delete(message.requestId);
        message.ok ? task.resolve(message.result) : task.reject(new Error(message.error?.message || 'Sandbox request failed'));
      }
      if (message.kind === 'event' && message.action === 'entity') {
        listeners.get(message.payload?.subscriptionId)?.(message.payload?.entity ?? null);
      }
      if (message.kind === 'event' && message.action === 'navigation') {
        listeners.get(message.payload?.subscriptionId)?.(message.payload?.view ?? null);
      }
    });
    const decode = (value) => new TextDecoder().decode(Uint8Array.from(atob(value), (char) => char.charCodeAt(0)));
    const api = Object.freeze({
      apiVersion,
      config: (() => {
        const deepFreeze = (value) => {
          if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
          Object.freeze(value);
          for (const child of Object.values(value)) deepFreeze(child);
          return value;
        };
        return deepFreeze(JSON.parse(decode(${JSON.stringify(encode(JSON.stringify(props.config ?? {})))})));
      })(),
      getEntity: (entityId) => request('getEntity', { entityId }),
      getIcon: (icon, options = {}) => request('getIcon', { icon, options }),
      callService: (domain, service, data = {}, target = {}) =>
        request('callService', { domain, service, data, target }),
      subscribeEntity(entityId, callback) {
        const subscriptionId = 'subscription-' + (++sequence);
        listeners.set(subscriptionId, callback);
        request('subscribeEntity', { entityId, subscriptionId }).catch((error) => {
          listeners.delete(subscriptionId);
          console.error(error);
        });
        return () => {
          listeners.delete(subscriptionId);
          send({ kind: 'request', requestId: String(++sequence), action: 'unsubscribeEntity', payload: { subscriptionId } });
        };
      },
      navigate: (viewId) => request('navigate', { viewId }),
      currentView: () => request('currentView'),
      listViews: () => request('listViews'),
      subscribeNavigation(callback) {
        const subscriptionId = 'navigation-' + (++sequence);
        listeners.set(subscriptionId, callback);
        request('subscribeNavigation', { subscriptionId }).catch((error) => {
          listeners.delete(subscriptionId);
          console.error(error);
        });
        return () => {
          listeners.delete(subscriptionId);
          send({ kind: 'request', requestId: String(++sequence), action: 'unsubscribeNavigation', payload: { subscriptionId } });
        };
      },
      getDashboardContext: () => request('getDashboardContext'),
      emitAction: (action, detail = {}) => request('emitAction', { action, detail }),
    });
    Object.defineProperty(window, 'vuePanel', { value: api, configurable: false, writable: false });
    const root = document.getElementById('card-root');
    root.innerHTML = decode(${JSON.stringify(encode(definition.html))});
    document.getElementById('card-style').textContent = decode(${JSON.stringify(encode(definition.css))});
    const theme = ${JSON.stringify(currentTheme())};
    for (const [name, value] of Object.entries(theme)) document.documentElement.style.setProperty(name, value);
    addEventListener('error', (event) => send({ kind: 'runtime-error', error: event.message || 'JavaScript error' }));
    addEventListener('unhandledrejection', (event) => send({ kind: 'runtime-error', error: String(event.reason) }));
    send({ kind: 'ready' });
  `
  const javascript = scriptSafe(definition.javascript)
  return `<!doctype html>
    <html><head>
      <meta charset="utf-8">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; connect-src 'none'; font-src data:; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'">
      <style>html,body,#card-root{box-sizing:border-box;width:100%;height:100%;margin:0}body{overflow:hidden;color:var(--text-primary);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*,*::before,*::after{box-sizing:inherit}</style>
      <style id="card-style"></style>
    </head><body><div id="card-root"></div>
      <script>${bootstrap}<\/script>
      <script>(async () => { try { ${javascript}\n } catch (error) { send({ kind: 'runtime-error', error: error instanceof Error ? error.message : String(error) }); } })();<\/script>
    </body></html>`
})

function post(message: Record<string, unknown>) {
  const payload = messageSnapshot({
    namespace: MESSAGE_NAMESPACE,
    apiVersion: SANDBOX_API_VERSION,
    channel,
    ...message,
  })
  iframe.value?.contentWindow?.postMessage(payload, '*')
}

function recordPayload(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw Object.assign(new Error(`${label} must be an object.`), { code: 'invalid_payload' })
  }
  return value as Record<string, unknown>
}

async function onMessage(event: MessageEvent) {
  if (event.source !== iframe.value?.contentWindow) return
  const message = event.data as Record<string, unknown> | null
  if (!message
    || message.namespace !== MESSAGE_NAMESPACE
    || message.apiVersion !== SANDBOX_API_VERSION
    || message.channel !== channel) return
  if (message.kind === 'runtime-error') {
    runtimeError.value = String(message.error || '')
    return
  }
  if (message.kind !== 'request') return

  const requestId = String(message.requestId || '')
  const respond = (ok: boolean, result?: unknown, code?: string, error?: string) =>
    post({
      kind: 'response',
      requestId,
      ok,
      result,
      error: ok ? undefined : { code: code ?? 'request_failed', message: error ?? 'Request failed' },
    })
  try {
    const action = String(message.action ?? '')
    const payload = message.payload && typeof message.payload === 'object'
      ? message.payload as Record<string, unknown>
      : {}
    const capabilityByAction: Record<string, PortableCardCapability> = {
      getEntity: 'entity:read',
      subscribeEntity: 'entity:subscribe',
      unsubscribeEntity: 'entity:subscribe',
      getIcon: 'icon:render',
      callService: 'service:call',
      navigate: 'navigation:write',
      currentView: 'navigation:read',
      listViews: 'navigation:read',
      subscribeNavigation: 'navigation:read',
      unsubscribeNavigation: 'navigation:read',
      getDashboardContext: 'dashboard:context',
      emitAction: 'shell:events',
    }
    const requiredCapability = capabilityByAction[action]
    if (requiredCapability && !renderDefinition.value.capabilities.includes(requiredCapability)) {
      throw Object.assign(new Error(`Capability ${requiredCapability} is not declared.`), {
        code: 'capability_denied',
      })
    }
    if (props.preview && ['callService', 'navigate', 'emitAction'].includes(action)) {
      throw Object.assign(new Error('This action is disabled in the preview.'), {
        code: 'preview_action_denied',
      })
    }
    if (JSON.stringify(payload).length > 64 * 1024) {
      throw Object.assign(new Error('Sandbox payload is too large.'), { code: 'invalid_payload' })
    }

    if (action === 'getEntity') {
      const entityId = String(payload.entityId ?? '')
      if (!/^[a-z0-9_]+\.[a-z0-9_]+$/.test(entityId)) throw new Error('Invalid entity ID.')
      respond(true, entities.value[entityId] ?? null)
    } else if (action === 'getIcon') {
      const options = (payload.options ?? {}) as Record<string, unknown>
      const icon = String(payload.icon ?? '')
      if (!/^mdi:[a-z0-9-]+$/.test(icon)) throw new Error('Invalid MDI icon name.')
      const size = Number(options.size ?? 64)
      const color = String(options.color ?? '#000000')
      if (!Number.isFinite(size) || size < 8 || size > 512 || color.length > 64) {
        throw new Error('Invalid icon options.')
      }
      respond(true, await mdiIconDataUrl(icon, size, color))
    } else if (action === 'subscribeEntity') {
      const subscriptionId = String(payload.subscriptionId)
      const entityId = String(payload.entityId)
      if (!/^[a-z0-9_]+\.[a-z0-9_]+$/.test(entityId)) throw new Error('Invalid entity ID.')
      subscriptions.set(subscriptionId, entityId)
      respond(true, null)
      post({
        kind: 'event',
        action: 'entity',
        payload: { subscriptionId, entity: entities.value[entityId] ?? null },
      })
    } else if (action === 'unsubscribeEntity') {
      subscriptions.delete(String(payload.subscriptionId))
      respond(true, null)
    } else if (action === 'callService') {
      const domain = String(payload.domain || '')
      const service = String(payload.service || '')
      if (!/^[a-z0-9_]+$/.test(domain) || !/^[a-z0-9_]+$/.test(service)) {
        throw new Error('Invalid service name.')
      }
      const data = recordPayload(payload.data ?? {}, 'Service data')
      const target = recordPayload(payload.target ?? {}, 'Service target')
      await callService(
        domain,
        service,
        data,
        target as never,
      )
      respond(true, null)
    } else if (action === 'navigate') {
      const viewId = String(payload.viewId ?? '')
      const view = store.viewById(viewId)
      if (!view) throw new Error('Unknown view ID.')
      navigatePanel(viewPath(view))
      respond(true, null)
    } else if (action === 'currentView') {
      const view = store.viewByRoute(routePath.value)
      respond(true, view ? { id: view.id, title: view.title, icon: view.icon, path: viewPath(view), subview: view.subview === true } : null)
    } else if (action === 'listViews') {
      respond(true, store.config.views.map((view) => ({
        id: view.id,
        title: view.title,
        icon: view.icon,
        path: viewPath(view),
        subview: view.subview === true,
      })))
    } else if (action === 'subscribeNavigation') {
      const subscriptionId = String(payload.subscriptionId ?? '')
      if (!/^navigation-[0-9]+$/.test(subscriptionId)) throw new Error('Invalid navigation subscription.')
      navigationSubscriptions.add(subscriptionId)
      respond(true, null)
      postNavigation(subscriptionId)
    } else if (action === 'unsubscribeNavigation') {
      navigationSubscriptions.delete(String(payload.subscriptionId ?? ''))
      respond(true, null)
    } else if (action === 'getDashboardContext') {
      respond(true, {
        theme: store.settings.theme,
        uiTheme: store.settings.uiTheme,
        language: locale.value,
        editMode: store.editMode,
      })
    } else if (action === 'emitAction') {
      const emittedAction = String(payload.action ?? '')
      const detail = recordPayload(payload.detail ?? {}, 'Action detail')
      if (!/^[a-z0-9]+(?:[-_:][a-z0-9]+)*$/.test(emittedAction)) {
        throw new Error('Invalid action name.')
      }
      emit('action', emittedAction, messageSnapshot(detail))
      respond(true, null)
    } else {
      throw new Error('Unsupported sandbox action.')
    }
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : 'request_failed'
    respond(false, undefined, code, error instanceof Error ? error.message : String(error))
  }
}

watch(() => props.definition, (value) => {
  if (renderTimer) clearTimeout(renderTimer)
  renderTimer = setTimeout(() => {
    runtimeError.value = ''
    subscriptions.clear()
    navigationSubscriptions.clear()
    renderDefinition.value = JSON.parse(JSON.stringify(value)) as SandboxCardDefinition
  }, 220)
}, { deep: true })

watch(entities, (value) => {
  for (const [subscriptionId, entityId] of subscriptions) {
    post({
      kind: 'event',
      action: 'entity',
      payload: { subscriptionId, entity: value[entityId] ?? null },
    })
  }
})

function currentViewSnapshot(): Record<string, unknown> | null {
  const view = store.viewByRoute(routePath.value)
  return view
    ? { id: view.id, title: view.title, icon: view.icon, path: viewPath(view), subview: view.subview === true }
    : null
}

function postNavigation(subscriptionId: string): void {
  post({
    kind: 'event',
    action: 'navigation',
    payload: { subscriptionId, view: currentViewSnapshot() },
  })
}

watch(routePath, () => {
  for (const subscriptionId of navigationSubscriptions) postNavigation(subscriptionId)
})

onMounted(() => window.addEventListener('message', onMessage))
onBeforeUnmount(() => {
  window.removeEventListener('message', onMessage)
  if (renderTimer) clearTimeout(renderTimer)
  navigationSubscriptions.clear()
})
</script>

<template>
  <div class="custom-card-sandbox">
    <iframe
      ref="iframe"
      :srcdoc="srcdoc"
      sandbox="allow-scripts"
      title="Custom card"
    />
    <div v-if="runtimeError" class="sandbox-error" :title="runtimeError">
      {{ runtimeError }}
    </div>
  </div>
</template>

<style scoped>
.custom-card-sandbox {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  border-radius: inherit;
}
.custom-card-sandbox iframe {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
  border: 0;
  background: transparent;
}
.sandbox-error {
  position: absolute;
  right: 8px;
  bottom: 8px;
  max-width: calc(100% - 16px);
  overflow: hidden;
  padding: 5px 8px;
  border-radius: 7px;
  background: #b3261e;
  color: #fff;
  font: 11px/1.25 system-ui, sans-serif;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
