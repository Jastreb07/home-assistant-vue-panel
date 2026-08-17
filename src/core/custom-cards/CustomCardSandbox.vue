<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { CustomCardDefinition } from '@/core/config/types'
import { callService, useEntities } from '@/core/ha'
import { mdiIconDataUrl } from '@/core/ui/mdiIconNames'

const props = withDefaults(defineProps<{
  definition: CustomCardDefinition
  config?: Record<string, unknown>
  preview?: boolean
}>(), { config: () => ({}) })

const MESSAGE_NAMESPACE = 'vue-panel:custom-card'
const THEME_VARIABLES = [
  '--bg', '--card-bg', '--card-bg-active', '--card-radius', '--card-shadow',
  '--text-primary', '--text-secondary', '--text-on-active', '--accent', '--divider',
  '--nav-bg', '--nav-item-hover', '--nav-item-active',
]

const iframe = ref<HTMLIFrameElement | null>(null)
const channel = `custom-${crypto.randomUUID()}`
const entities = useEntities()
const subscriptions = new Map<string, string>()
const renderDefinition = ref<CustomCardDefinition>({ ...props.definition })
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
    const channel = ${JSON.stringify(channel)};
    const pending = new Map();
    const listeners = new Map();
    let sequence = 0;
    const send = (message) => parent.postMessage({ namespace, channel, ...message }, '*');
    const request = (action, payload = {}) => new Promise((resolve, reject) => {
      const requestId = String(++sequence);
      pending.set(requestId, { resolve, reject });
      send({ kind: 'request', requestId, action, ...payload });
    });
    addEventListener('message', (event) => {
      const message = event.data;
      if (!message || message.namespace !== namespace || message.channel !== channel) return;
      if (message.kind === 'response') {
        const task = pending.get(message.requestId);
        if (!task) return;
        pending.delete(message.requestId);
        message.ok ? task.resolve(message.result) : task.reject(new Error(message.error));
      }
      if (message.kind === 'entity') listeners.get(message.subscriptionId)?.(message.entity);
    });
    const api = Object.freeze({
      config: Object.freeze(JSON.parse(decodeURIComponent(escape(atob(${JSON.stringify(encode(JSON.stringify(props.config ?? {})))}))))),
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
          send({ kind: 'request', requestId: String(++sequence), action: 'unsubscribeEntity', subscriptionId });
        };
      },
    });
    Object.defineProperty(window, 'vuePanel', { value: api, configurable: false, writable: false });
    const decode = (value) => new TextDecoder().decode(Uint8Array.from(atob(value), (char) => char.charCodeAt(0)));
    const root = document.getElementById('card-root');
    root.innerHTML = decode(${JSON.stringify(encode(definition.html))});
    document.getElementById('card-style').textContent = decode(${JSON.stringify(encode(definition.css))});
    const theme = ${JSON.stringify(currentTheme())};
    for (const [name, value] of Object.entries(theme)) document.documentElement.style.setProperty(name, value);
    addEventListener('error', (event) => send({ kind: 'runtimeError', error: event.message || 'JavaScript error' }));
    addEventListener('unhandledrejection', (event) => send({ kind: 'runtimeError', error: String(event.reason) }));
  `
  const javascript = scriptSafe(definition.javascript)
  const origin = location.origin.replace(/["<>]/g, '')
  return `<!doctype html>
    <html><head>
      <meta charset="utf-8">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob: ${origin}; media-src data: blob: ${origin}; connect-src 'none'; font-src data:; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'">
      <style>html,body,#card-root{box-sizing:border-box;width:100%;height:100%;margin:0}body{overflow:hidden;color:var(--text-primary);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*,*::before,*::after{box-sizing:inherit}</style>
      <style id="card-style"></style>
    </head><body><div id="card-root"></div>
      <script>${bootstrap}<\/script>
      <script>(async () => { try { ${javascript}\n } catch (error) { send({ kind: 'runtimeError', error: error instanceof Error ? error.message : String(error) }); } })();<\/script>
    </body></html>`
})

function post(message: Record<string, unknown>) {
  const payload = messageSnapshot({ namespace: MESSAGE_NAMESPACE, channel, ...message })
  iframe.value?.contentWindow?.postMessage(payload, '*')
}

async function onMessage(event: MessageEvent) {
  if (event.source !== iframe.value?.contentWindow) return
  const message = event.data as Record<string, unknown> | null
  if (!message || message.namespace !== MESSAGE_NAMESPACE || message.channel !== channel) return
  if (message.kind === 'runtimeError') {
    runtimeError.value = String(message.error || '')
    return
  }
  if (message.kind !== 'request') return

  const requestId = String(message.requestId || '')
  const respond = (ok: boolean, result?: unknown, error?: string) =>
    post({ kind: 'response', requestId, ok, result, error })
  try {
    if (message.action === 'getEntity') {
      respond(true, entities.value[String(message.entityId)] ?? null)
    } else if (message.action === 'getIcon') {
      const options = (message.options ?? {}) as Record<string, unknown>
      const icon = String(message.icon ?? '')
      if (!/^mdi:[a-z0-9-]+$/.test(icon)) throw new Error('Invalid MDI icon name.')
      const size = Number(options.size ?? 64)
      const color = String(options.color ?? '#000000')
      respond(true, await mdiIconDataUrl(icon, size, color))
    } else if (message.action === 'subscribeEntity') {
      const subscriptionId = String(message.subscriptionId)
      const entityId = String(message.entityId)
      subscriptions.set(subscriptionId, entityId)
      respond(true, null)
      post({ kind: 'entity', subscriptionId, entity: entities.value[entityId] ?? null })
    } else if (message.action === 'unsubscribeEntity') {
      subscriptions.delete(String(message.subscriptionId))
      respond(true, null)
    } else if (message.action === 'callService') {
      if (props.preview) throw new Error('Service calls are disabled in the preview.')
      const domain = String(message.domain || '')
      const service = String(message.service || '')
      if (!/^[a-z0-9_]+$/.test(domain) || !/^[a-z0-9_]+$/.test(service)) {
        throw new Error('Invalid service name.')
      }
      await callService(
        domain,
        service,
        (message.data ?? {}) as Record<string, unknown>,
        message.target as never,
      )
      respond(true, null)
    } else {
      throw new Error('Unsupported sandbox action.')
    }
  } catch (error) {
    respond(false, undefined, error instanceof Error ? error.message : String(error))
  }
}

watch(() => props.definition, (value) => {
  if (renderTimer) clearTimeout(renderTimer)
  renderTimer = setTimeout(() => {
    runtimeError.value = ''
    subscriptions.clear()
    renderDefinition.value = JSON.parse(JSON.stringify(value)) as CustomCardDefinition
  }, 220)
}, { deep: true })

watch(entities, (value) => {
  for (const [subscriptionId, entityId] of subscriptions) {
    post({ kind: 'entity', subscriptionId, entity: value[entityId] ?? null })
  }
})

onMounted(() => window.addEventListener('message', onMessage))
onBeforeUnmount(() => {
  window.removeEventListener('message', onMessage)
  if (renderTimer) clearTimeout(renderTimer)
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
  min-height: 120px;
  overflow: hidden;
  border-radius: inherit;
}
.custom-card-sandbox iframe {
  display: block;
  width: 100%;
  height: 100%;
  min-height: inherit;
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
