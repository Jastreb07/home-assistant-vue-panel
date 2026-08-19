<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PortableCardCapability } from '@/core/registry/portableCardTypes'
import { callService, useEntities } from '@/core/ha'
import { useDashboardStore, viewPath } from '@/core/config/dashboardStore'
import { navigatePanel, usePanelRoutePath } from '@/core/router/panelNavigation'
import { useI18n } from 'vue-i18n'
import { mdiIconDataUrl } from '@/core/ui/mdiIconNames'
import { runtimeId } from '@/core/utils/runtimeId'

/**
 * Runs one portable card inside the engine document. Markup is injected into
 * this component's root, the card CSS is scoped to it through native CSS
 * nesting, and the card script runs against a scoped `document` so the
 * theme's global stylesheet reaches the card while its own rules stay local.
 *
 * The card shares the engine's origin: it is a styling and DOM boundary,
 * not a security boundary.
 */
const props = withDefaults(defineProps<{
  definition: CardDefinition
  config?: Record<string, unknown>
  preview?: boolean
}>(), { config: () => ({}) })
const emit = defineEmits<{
  action: [action: string, detail: Record<string, unknown>]
}>()

const CARD_API_VERSION = 1

interface CardDefinition {
  html: string
  css: string
  javascript: string
  capabilities: PortableCardCapability[]
}

/** Sizing the card can rely on; everything else comes from the theme. */
const BASE_CSS = `box-sizing: border-box;
width: 100%;
height: 100%;
overflow: hidden;
& *, & *::before, & *::after { box-sizing: inherit; }`

const CAPABILITY_BY_ACTION: Record<string, PortableCardCapability> = {
  getEntity: 'entity:read',
  subscribeEntity: 'entity:subscribe',
  getIcon: 'icon:render',
  callService: 'service:call',
  navigate: 'navigation:write',
  currentView: 'navigation:read',
  listViews: 'navigation:read',
  subscribeNavigation: 'navigation:read',
  getDashboardContext: 'dashboard:context',
  emitAction: 'shell:events',
}
const PREVIEW_DENIED = ['callService', 'navigate', 'emitAction']

const scope = runtimeId('card')
const root = ref<HTMLElement | null>(null)
const runtimeError = ref('')

const entities = useEntities()
const store = useDashboardStore()
const routePath = usePanelRoutePath()
const { locale } = useI18n()

const entitySubscriptions = new Map<string, { entityId: string; callback: (entity: unknown) => void }>()
const navigationSubscriptions = new Map<string, (view: unknown) => void>()

let styleElement: HTMLStyleElement | null = null
let teardown: Array<() => void> = []
let renderTimer: ReturnType<typeof setTimeout> | null = null
let renderVersion = 0

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  Object.freeze(value)
  for (const child of Object.values(value)) deepFreeze(child)
  return value
}

function snapshot(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}

function recordPayload(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
  return value as Record<string, unknown>
}

function viewSnapshot(view: ReturnType<typeof store.viewById>) {
  return view
    ? {
      id: view.id,
      title: view.title,
      icon: view.icon,
      path: viewPath(view),
      subview: view.subview === true,
    }
    : null
}

// ── Card API ─────────────────────────────────────────────────
function buildApi(capabilities: PortableCardCapability[]) {
  const guard = (action: string) => {
    const required = CAPABILITY_BY_ACTION[action]
    if (required && !capabilities.includes(required)) {
      throw new Error(`Capability ${required} is not declared.`)
    }
    if (props.preview && PREVIEW_DENIED.includes(action)) {
      throw new Error('This action is disabled in the preview.')
    }
  }
  let sequence = 0

  return Object.freeze({
    apiVersion: CARD_API_VERSION,
    config: deepFreeze(snapshot(props.config ?? {})),

    async getEntity(entityId: string) {
      guard('getEntity')
      if (!/^[a-z0-9_]+\.[a-z0-9_]+$/.test(String(entityId))) throw new Error('Invalid entity ID.')
      return entities.value[entityId] ?? null
    },

    async getIcon(icon: string, options: Record<string, unknown> = {}) {
      guard('getIcon')
      if (!/^mdi:[a-z0-9-]+$/.test(String(icon))) throw new Error('Invalid MDI icon name.')
      const size = Number(options.size ?? 64)
      const color = String(options.color ?? '#000000')
      if (!Number.isFinite(size) || size < 8 || size > 512 || color.length > 64) {
        throw new Error('Invalid icon options.')
      }
      return mdiIconDataUrl(icon, size, color)
    },

    async callService(
      domain: string,
      service: string,
      data: Record<string, unknown> = {},
      target: Record<string, unknown> = {},
    ) {
      guard('callService')
      if (!/^[a-z0-9_]+$/.test(String(domain)) || !/^[a-z0-9_]+$/.test(String(service))) {
        throw new Error('Invalid service name.')
      }
      await callService(
        domain,
        service,
        recordPayload(data, 'Service data'),
        recordPayload(target, 'Service target') as never,
      )
      return null
    },

    subscribeEntity(entityId: string, callback: (entity: unknown) => void) {
      guard('subscribeEntity')
      if (!/^[a-z0-9_]+\.[a-z0-9_]+$/.test(String(entityId))) throw new Error('Invalid entity ID.')
      const subscriptionId = `subscription-${++sequence}`
      entitySubscriptions.set(subscriptionId, { entityId, callback })
      callback(entities.value[entityId] ?? null)
      return () => entitySubscriptions.delete(subscriptionId)
    },

    async navigate(viewId: string) {
      guard('navigate')
      const view = store.viewById(String(viewId))
      if (!view) throw new Error('Unknown view ID.')
      navigatePanel(viewPath(view))
      return null
    },

    async currentView() {
      guard('currentView')
      return viewSnapshot(store.viewByRoute(routePath.value))
    },

    async listViews() {
      guard('listViews')
      return store.config.views.map((view) => viewSnapshot(view))
    },

    subscribeNavigation(callback: (view: unknown) => void) {
      guard('subscribeNavigation')
      const subscriptionId = `navigation-${++sequence}`
      navigationSubscriptions.set(subscriptionId, callback)
      callback(viewSnapshot(store.viewByRoute(routePath.value)))
      return () => navigationSubscriptions.delete(subscriptionId)
    },

    async getDashboardContext() {
      guard('getDashboardContext')
      return {
        theme: store.settings.theme,
        uiTheme: store.settings.uiTheme,
        language: locale.value,
        editMode: store.editMode,
      }
    },

    async emitAction(action: string, detail: Record<string, unknown> = {}) {
      guard('emitAction')
      if (!/^[a-z0-9]+(?:[-_:][a-z0-9]+)*$/.test(String(action))) {
        throw new Error('Invalid action name.')
      }
      emit('action', action, snapshot(recordPayload(detail, 'Action detail')))
      return null
    },
  })
}

// ── Scoped globals ───────────────────────────────────────────
/**
 * Element lookups resolve inside the card, timers and global listeners are
 * tracked — a card must not keep running once its component is gone.
 */
function createScopedGlobals(host: HTMLElement) {
  const timeouts = new Set<ReturnType<typeof setTimeout>>()
  const intervals = new Set<ReturnType<typeof setInterval>>()
  const listeners: Array<[EventTarget, string, EventListenerOrEventListenerObject, unknown]> = []

  const scopedSetTimeout = (handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    const id = setTimeout(handler as () => void, timeout, ...args)
    timeouts.add(id)
    return id
  }
  const scopedSetInterval = (handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    const id = setInterval(handler as () => void, timeout, ...args)
    intervals.add(id)
    return id
  }
  const scopedClearTimeout = (id?: ReturnType<typeof setTimeout>) => {
    if (id !== undefined) timeouts.delete(id)
    clearTimeout(id)
  }
  const scopedClearInterval = (id?: ReturnType<typeof setInterval>) => {
    if (id !== undefined) intervals.delete(id)
    clearInterval(id)
  }
  const addListenerOn = (target: EventTarget) => (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: unknown,
  ) => {
    target.addEventListener(type, listener, options as AddEventListenerOptions)
    listeners.push([target, type, listener, options])
  }
  const removeListenerOn = (target: EventTarget) => (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: unknown,
  ) => {
    target.removeEventListener(type, listener, options as EventListenerOptions)
  }

  /** Forward everything the card did not ask us to scope. */
  const passThrough = (target: object, property: string | symbol) => {
    const value = Reflect.get(target, property, target)
    return typeof value === 'function' ? value.bind(target) : value
  }

  const documentProxy = new Proxy(document, {
    get(target, property) {
      if (property === 'getElementById') {
        return (id: string) => host.querySelector(`#${CSS.escape(String(id))}`)
      }
      if (property === 'querySelector') return (selector: string) => host.querySelector(selector)
      if (property === 'querySelectorAll') return (selector: string) => host.querySelectorAll(selector)
      if (property === 'addEventListener') return addListenerOn(document)
      if (property === 'removeEventListener') return removeListenerOn(document)
      return passThrough(target, property)
    },
  }) as Document

  const windowProxy = new Proxy(window, {
    get(target, property) {
      if (property === 'setTimeout') return scopedSetTimeout
      if (property === 'setInterval') return scopedSetInterval
      if (property === 'clearTimeout') return scopedClearTimeout
      if (property === 'clearInterval') return scopedClearInterval
      if (property === 'addEventListener') return addListenerOn(window)
      if (property === 'removeEventListener') return removeListenerOn(window)
      if (property === 'document') return documentProxy
      return passThrough(target, property)
    },
  })

  const dispose = () => {
    for (const id of timeouts) clearTimeout(id)
    for (const id of intervals) clearInterval(id)
    for (const [target, type, listener, options] of listeners) {
      target.removeEventListener(type, listener, options as EventListenerOptions)
    }
    timeouts.clear()
    intervals.clear()
    listeners.length = 0
  }

  return {
    dispose,
    globals: {
      document: documentProxy,
      window: windowProxy,
      setTimeout: scopedSetTimeout,
      setInterval: scopedSetInterval,
      clearTimeout: scopedClearTimeout,
      clearInterval: scopedClearInterval,
      addEventListener: addListenerOn(window),
      removeEventListener: removeListenerOn(window),
    },
  }
}

// ── Rendering ────────────────────────────────────────────────
function applyStyles(css: string) {
  if (!styleElement) {
    styleElement = document.createElement('style')
    styleElement.setAttribute('data-vp-card-runtime', scope)
    document.head.appendChild(styleElement)
  }
  // Doubled attribute so the card's own rules win over generic theme rules
  const selector = `[data-vp-card-scope="${CSS.escape(scope)}"]`
  styleElement.textContent = `${selector}${selector} {\n${BASE_CSS}\n${css}\n}`
}

function disposeRuntime() {
  for (const dispose of teardown) {
    try {
      dispose()
    } catch (error) {
      console.warn('[vue-panel] Card teardown failed:', error)
    }
  }
  teardown = []
  entitySubscriptions.clear()
  navigationSubscriptions.clear()
  if (root.value) root.value.replaceChildren()
}

function render() {
  const host = root.value
  if (!host) return
  const version = ++renderVersion
  disposeRuntime()
  runtimeError.value = ''

  const definition = props.definition
  applyStyles(definition.css)
  host.innerHTML = definition.html

  const { dispose, globals } = createScopedGlobals(host)
  teardown.push(dispose)

  const fail = (error: unknown) => {
    if (version !== renderVersion) return
    runtimeError.value = error instanceof Error ? error.message : String(error)
  }

  try {
    const factory = new Function(
      'vuePanel',
      'document',
      'window',
      'self',
      'setTimeout',
      'setInterval',
      'clearTimeout',
      'clearInterval',
      'addEventListener',
      'removeEventListener',
      `"use strict";\nreturn (async () => {\n${definition.javascript}\n})()`,
    )
    const result = factory(
      buildApi(definition.capabilities),
      globals.document,
      globals.window,
      globals.window,
      globals.setTimeout,
      globals.setInterval,
      globals.clearTimeout,
      globals.clearInterval,
      globals.addEventListener,
      globals.removeEventListener,
    ) as Promise<unknown>
    void Promise.resolve(result).catch(fail)
  } catch (error) {
    fail(error)
  }
}

/** The card editor streams edits — re-running on every keystroke would thrash. */
watch(() => props.definition, () => {
  if (renderTimer) clearTimeout(renderTimer)
  renderTimer = setTimeout(render, 220)
}, { deep: true })

watch(() => props.config, render, { deep: true })

watch(entities, (value) => {
  for (const { entityId, callback } of entitySubscriptions.values()) {
    callback(value[entityId] ?? null)
  }
})

/**
 * Navigation subscribers also care about the view list itself: renaming or
 * reordering views must reach a navigation card without a reload.
 */
const navigationSignature = computed(() =>
  JSON.stringify([
    routePath.value,
    store.config.views.map((view) => [
      view.id,
      view.title,
      view.icon,
      viewPath(view),
      view.subview === true,
    ]),
  ]),
)

watch(navigationSignature, () => {
  const view = viewSnapshot(store.viewByRoute(routePath.value))
  for (const callback of navigationSubscriptions.values()) callback(view)
})

onMounted(render)
onBeforeUnmount(() => {
  if (renderTimer) clearTimeout(renderTimer)
  disposeRuntime()
  styleElement?.remove()
  styleElement = null
})
</script>

<template>
  <div class="card-runtime">
    <div ref="root" class="card-runtime-content" :data-vp-card-scope="scope" />
    <div v-if="runtimeError" class="card-runtime-error" :title="runtimeError">
      {{ runtimeError }}
    </div>
  </div>
</template>

<style scoped>
.card-runtime {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  border-radius: inherit;
}
.card-runtime-content {
  width: 100%;
  height: 100%;
  min-height: 0;
  border-radius: inherit;
}
.card-runtime-error {
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
