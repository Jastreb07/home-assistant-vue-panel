<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { CardTranslations, PortableCardCapability } from '@/core/registry/portableCardTypes'
import { cardTranslation } from '@/core/registry/cardTranslations'
import {
  callService,
  callServiceWithResponse,
  getEntityAreas as resolveEntityAreas,
  useEntities,
} from '@/core/ha'
import { useHostBadges } from '@/core/ha/hostBadges'
import { openHostMoreInfo, openHostTarget, openHostUrl, openHostView } from '@/core/router/hostSidebar'
import { useDashboardStore, viewPath } from '@/core/config/dashboardStore'
import { navigatePanel, usePanelRoutePath } from '@/core/router/panelNavigation'
import { useI18n } from 'vue-i18n'
import { mdiIconDataUrl } from '@/core/ui/mdiIconNames'
import { runtimeId } from '@/core/utils/runtimeId'
import type {
  CardDetailConfig,
  DialogContentPosition,
  DialogMobileHeight,
} from '@/core/config/types'
import type { CardArea } from '@/core/registry/cardRegistry'
import { popupCloseKey, popupContextKey, resolvePlaceholders } from '@/core/popups/popupContext'
import { openDetail, openPopup } from '@/core/popups/popupService'

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
  /**
   * Where this instance sits. Cards read it through `vuePanel.area` and can
   * style against it via `&[data-vp-area='sidebar']`, so one card can bring
   * its own variant per placement instead of asking the user to configure one.
   */
  area?: CardArea
}>(), { config: () => ({}), area: 'dashboard' })
const emit = defineEmits<{
  action: [action: string, detail: Record<string, unknown>]
}>()

const CARD_API_VERSION = 1

interface CardDefinition {
  html: string
  css: string
  javascript: string
  capabilities: PortableCardCapability[]
  /** Detail view this card opens for the `more-info` action */
  detail?: CardDetailConfig
  /** Catalogs behind `vuePanel.t()` — a card without them shows its keys */
  translations?: CardTranslations
  /** HTTP root of a folder card's own files — empty for a single-file card */
  assetBase?: string
}

/**
 * Sizing the card can rely on; everything else comes from the theme.
 *
 * Clipping keeps a card's DOM contained, but plain `overflow: hidden` sits
 * flush with the card's edge and cut off the `box-shadow` almost every
 * bundled card paints on its own root. `overflow: clip` does the same
 * containment while `overflow-clip-margin` grants a bleed area for exactly
 * that shadow — and, unlike sizing or positioning tricks, it changes no
 * layout at all, so cards that derive their height from their content
 * (every bar-hosted card) are unaffected. Browsers without
 * `overflow-clip-margin` simply clip at the edge again, as before.
 */
const BASE_CSS = `box-sizing: border-box;
width: 100%;
height: 100%;
overflow: clip;
overflow-clip-margin: 16px;
& *, & *::before, & *::after { box-sizing: inherit; }`

const CAPABILITY_BY_ACTION: Record<string, PortableCardCapability> = {
  getEntity: 'entity:read',
  getEntityAreas: 'entity:read',
  subscribeEntity: 'entity:subscribe',
  getIcon: 'icon:render',
  callService: 'service:call',
  callServiceWithResponse: 'service:call',
  navigate: 'navigation:write',
  currentView: 'navigation:read',
  listViews: 'navigation:read',
  subscribeNavigation: 'navigation:read',
  getDashboardContext: 'dashboard:context',
  subscribeDashboardContext: 'dashboard:context',
  emitAction: 'shell:events',
  showDetail: 'dialog:open',
  closeDialog: 'dialog:open',
  showNativeDetail: 'dialog:open',
  openPopup: 'dialog:open',
  openHostTarget: 'host:navigate',
  subscribeHostBadges: 'host:badges',
  openUrl: 'navigation:write',
}
const PREVIEW_DENIED = [
  'callService',
  'callServiceWithResponse',
  'navigate',
  'emitAction',
  'showDetail',
  'closeDialog',
  'showNativeDetail',
  'openPopup',
  'openHostTarget',
  'openUrl',
]

const scope = runtimeId('card')
const root = ref<HTMLElement | null>(null)
const runtimeError = ref('')

const entities = useEntities()
const store = useDashboardStore()
const routePath = usePanelRoutePath()
const { locale } = useI18n()

/**
 * Inside a popup or detail view the card may reference the values the dialog
 * was opened with — as `${key}` in its own configuration and as
 * `vuePanel.context` in its script.
 */
const popupContext = inject(popupContextKey, null)
const closeCurrentDialog = inject(popupCloseKey, null)
const cardConfig = computed<Record<string, unknown>>(() => {
  const config = props.config ?? {}
  return popupContext ? resolvePlaceholders(config, popupContext.value) : config
})

const entitySubscriptions = new Map<string, { entityId: string; callback: (entity: unknown) => void }>()
const navigationSubscriptions = new Map<string, (view: unknown) => void>()
const badgeSubscriptions = new Map<string, (badges: unknown) => void>()
const contextSubscriptions = new Map<string, (context: unknown) => void>()
const hostBadges = useHostBadges()

/** What a card is told about the dashboard it runs in. */
function dashboardContext() {
  return {
    theme: store.settings.theme,
    uiTheme: store.settings.uiTheme,
    language: locale.value,
    editMode: store.editMode,
  }
}

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
    config: deepFreeze(snapshot(cardConfig.value)),

    /** Values of the popup or detail view this card runs in — empty otherwise. */
    context: deepFreeze(snapshot(popupContext?.value ?? {})),

    /**
     * Where this card instance sits: 'dashboard', 'sidebar', 'header',
     * 'bottom' or 'dialog'. Fixed for the lifetime of an instance — moving a
     * card elsewhere creates a new one — so a plain value is enough.
     * The same value is on the card root as `data-vp-area` for CSS.
     */
    area: props.area,

    /** Language the panel currently runs in — cards render text for it. */
    language: locale.value,

    /**
     * URL of a file the card ships next to its own `index.html`, e.g.
     * `vuePanel.asset('assets/sun.svg')`. Only cards stored as a folder have
     * somewhere to put those files; a single-file card has not, and saying so
     * beats handing back a URL that will 404.
     */
    asset(path: string) {
      const base = props.definition.assetBase ?? ''
      if (!base) throw new Error('This card has no asset folder — store it as a folder card.')
      // A card must not reach outside its own folder
      const clean = String(path ?? '').replace(/^\/+/, '')
      if (!clean || clean.split('/').includes('..')) throw new Error(`Invalid asset path: ${path}`)
      return new URL(base + clean, location.origin).href
    },

    /**
     * Text from the card's own translation block. Missing texts fall back to
     * the card's fallback language, then English, then the key itself — no
     * capability is needed because nothing but card-authored text is read.
     */
    t(key: string) {
      return cardTranslation(props.definition.translations, String(key), locale.value)
    },

    async getEntity(entityId: string) {
      guard('getEntity')
      if (!/^[a-z0-9_]+\.[a-z0-9_]+$/.test(String(entityId))) throw new Error('Invalid entity ID.')
      return entities.value[entityId] ?? null
    },

    async getEntityAreas(entityIds: unknown) {
      guard('getEntityAreas')
      if (!Array.isArray(entityIds) || entityIds.length > 100) {
        throw new Error('Entity IDs must be an array with at most 100 entries.')
      }
      const ids = [...new Set(entityIds.map(String))]
      if (ids.some((entityId) => !/^[a-z0-9_]+\.[a-z0-9_]+$/.test(entityId))) {
        throw new Error('Invalid entity ID.')
      }
      return deepFreeze(snapshot(await resolveEntityAreas(ids)))
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

    /**
     * Call a service that answers with data, such as
     * `weather.get_forecasts`. Same capability as `callService` — it is the
     * same call, only the reply is handed back instead of dropped.
     */
    async callServiceWithResponse(
      domain: string,
      service: string,
      data: Record<string, unknown> = {},
      target: Record<string, unknown> = {},
    ) {
      guard('callServiceWithResponse')
      if (!/^[a-z0-9_]+$/.test(String(domain)) || !/^[a-z0-9_]+$/.test(String(service))) {
        throw new Error('Invalid service name.')
      }
      const response = await callServiceWithResponse(
        domain,
        service,
        recordPayload(data, 'Service data'),
        recordPayload(target, 'Service target') as never,
      )
      // The card gets a plain, frozen copy — never a live Home Assistant object
      return deepFreeze(snapshot(response))
    },

    subscribeEntity(entityId: string, callback: (entity: unknown) => void) {
      guard('subscribeEntity')
      if (!/^[a-z0-9_]+\.[a-z0-9_]+$/.test(String(entityId))) throw new Error('Invalid entity ID.')
      const subscriptionId = `subscription-${++sequence}`
      entitySubscriptions.set(subscriptionId, { entityId, callback })
      callback(entities.value[entityId] ?? null)
      return () => entitySubscriptions.delete(subscriptionId)
    },

    /**
     * Open a view. `newTab` hands the job to the host page: only it knows the
     * panel's URL prefix, and only a top-level tab shows the whole shell
     * rather than the bare engine document.
     */
    async navigate(viewId: string, options: Record<string, unknown> = {}) {
      guard('navigate')
      const view = store.viewById(String(viewId))
      if (!view) throw new Error('Unknown view ID.')
      if (recordPayload(options, 'Navigate options').newTab === true) {
        openHostView(viewPath(view))
        return null
      }
      navigatePanel(viewPath(view))
      return null
    },

    /**
     * Follow a link that leaves the dashboard. In the same tab the host page
     * has to navigate — the card lives in an iframe, and replacing only that
     * would strand the link inside the panel frame.
     */
    async openUrl(url: unknown, options: Record<string, unknown> = {}) {
      guard('openUrl')
      const target = String(url).trim()
      if (!target) throw new Error('A URL is required.')
      openHostUrl(target, recordPayload(options, 'Open options').newTab === true)
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

    /**
     * Open one of Home Assistant's own screens — its config page or its
     * notification drawer. Both live outside this panel, so the host page
     * performs the actual navigation.
     */
    async openHostTarget(target: unknown) {
      guard('openHostTarget')
      const value = String(target)
      if (value !== 'settings' && value !== 'notifications') {
        throw new Error('Unknown host target.')
      }
      openHostTarget(value)
      return null
    },

    /**
     * The counters Home Assistant shows on its own sidebar. Reports the
     * current values immediately and on every change.
     */
    subscribeHostBadges(callback: (badges: unknown) => void) {
      guard('subscribeHostBadges')
      const subscriptionId = `badges-${++sequence}`
      badgeSubscriptions.set(subscriptionId, callback)
      callback({ settings: hostBadges.settings.value, notifications: hostBadges.notifications.value })
      return () => badgeSubscriptions.delete(subscriptionId)
    },

    async getDashboardContext() {
      guard('getDashboardContext')
      return dashboardContext()
    },

    /**
     * The same context, but pushed on every change — a card that adapts to
     * edit mode would otherwise keep the value it read once at startup.
     * Reports the current state immediately.
     */
    subscribeDashboardContext(callback: (context: unknown) => void) {
      guard('subscribeDashboardContext')
      const subscriptionId = `context-${++sequence}`
      contextSubscriptions.set(subscriptionId, callback)
      callback(dashboardContext())
      return () => contextSubscriptions.delete(subscriptionId)
    },

    async emitAction(action: string, detail: Record<string, unknown> = {}) {
      guard('emitAction')
      if (!/^[a-z0-9]+(?:[-_:][a-z0-9]+)*$/.test(String(action))) {
        throw new Error('Invalid action name.')
      }
      emit('action', action, snapshot(recordPayload(detail, 'Action detail')))
      return null
    },

    /**
     * Open the detail view of this card: the requested dialog card, the card's
     * own `detail.card`, or the default card of the entity's domain.
     */
    async showDetail(options: Record<string, unknown> = {}) {
      guard('showDetail')
      const payload = recordPayload(options, 'Detail options')
      const card = payload.card === undefined ? undefined : String(payload.card)
      if (card && !/^[a-z0-9-]+\/[a-z0-9-]+$/.test(card)) throw new Error('Invalid card type.')
      const variables = Array.isArray(payload.variables)
        ? payload.variables.map(String)
        : undefined
      const context = payload.context === undefined
        ? undefined
        : snapshot(recordPayload(payload.context, 'Detail context'))
      let position: DialogContentPosition | undefined
      if (payload.position !== undefined) {
        const value = String(payload.position)
        if (value !== 'top' && value !== 'center' && value !== 'bottom') {
          throw new Error('Invalid detail dialog position.')
        }
        position = value
      }
      let mobileHeight: DialogMobileHeight | undefined
      if (payload.mobileHeight !== undefined) {
        const value = String(payload.mobileHeight)
        if (value !== 'full' && value !== 'fit-content') {
          throw new Error('Invalid mobile detail dialog height.')
        }
        mobileHeight = value
      }
      openDetail(snapshot(cardConfig.value), props.definition.detail, {
        card,
        entityId: payload.entity === undefined ? undefined : String(payload.entity),
        variables,
        context,
        position,
        mobileHeight,
      })
      return null
    },

    /** Close the popup or detail view containing this card. */
    async closeDialog() {
      guard('closeDialog')
      if (!closeCurrentDialog) throw new Error('This card is not inside a dialog.')
      closeCurrentDialog()
      return null
    },

    /** Open Home Assistant's native more-info dialog in the host document. */
    async showNativeDetail(entityId: string) {
      guard('showNativeDetail')
      const value = String(entityId)
      if (!/^[a-z0-9_]+\.[a-z0-9_]+$/.test(value)) throw new Error('Invalid entity ID.')
      openHostMoreInfo(value)
      return null
    },

    /** Open a custom popup — by default with all values of this card. */
    async openPopup(popupId: string, context?: Record<string, unknown>) {
      guard('openPopup')
      if (!store.popupById(String(popupId))) throw new Error('Unknown popup ID.')
      openPopup(
        String(popupId),
        context === undefined
          ? snapshot(cardConfig.value)
          : snapshot(recordPayload(context, 'Popup context')),
      )
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
  badgeSubscriptions.clear()
  contextSubscriptions.clear()
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

watch(cardConfig, render, { deep: true })

/** Cards build their text once per render, so a language switch re-runs them. */
watch(locale, render)

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

/** Edit mode, theme and language changes, pushed to every subscribed card. */
watch(
  () => [store.editMode, store.settings.theme, store.settings.uiTheme, locale.value] as const,
  () => {
    const context = dashboardContext()
    for (const callback of contextSubscriptions.values()) callback(context)
  },
)

/** Home Assistant's sidebar counters, pushed to every subscribed card. */
watch(
  () => [hostBadges.settings.value, hostBadges.notifications.value] as const,
  ([settings, notifications]) => {
    for (const callback of badgeSubscriptions.values()) callback({ settings, notifications })
  },
)

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
    <div ref="root" class="card-runtime-content" :data-vp-card-scope="scope" :data-vp-area="area" />
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
