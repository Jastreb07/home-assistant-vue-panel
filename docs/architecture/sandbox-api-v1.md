# Vue Panel Sandbox API v1

Status: normative security and messaging contract for Card Format v2.

## Security boundary

Every portable card runs in its own iframe with `sandbox="allow-scripts"`. The iframe must not
receive `allow-same-origin`, `allow-forms`, `allow-popups`, or top-navigation permissions. Its
document uses a restrictive Content Security Policy with no network connections, frames,
objects, forms, or base URL.

The host never sends an access token, the Home Assistant `hass` object, a WebSocket connection,
DOM references, functions, or Vue reactive proxies. Messages contain structured-clone-safe
snapshots only. The host validates the iframe window, namespace, channel, message kind, payload,
declared capability, and response correlation before performing an action.

## Message envelope

All host/card messages use this envelope:

```json
{
  "namespace": "vue-panel:card",
  "apiVersion": 1,
  "channel": "runtime-generated-id",
  "kind": "request",
  "requestId": "1",
  "action": "getEntity",
  "payload": {}
}
```

`kind` is one of `ready`, `request`, `response`, `event`, or `runtime-error`. Responses echo the
request ID and contain either `{ "ok": true, "result": ... }` or
`{ "ok": false, "error": { "code": "...", "message": "..." } }`.

## JavaScript API

The iframe exposes one frozen global object:

```ts
interface VuePanelCardApiV1 {
  readonly apiVersion: 1
  readonly config: Readonly<Record<string, unknown>>
  getEntity(entityId: string): Promise<EntitySnapshot | null>
  subscribeEntity(
    entityId: string,
    callback: (entity: EntitySnapshot | null) => void,
  ): () => void
  getIcon(icon: string, options?: { size?: number; color?: string }): Promise<string>
  callService(
    domain: string,
    service: string,
    data?: Record<string, unknown>,
    target?: Record<string, unknown>,
  ): Promise<void>
  navigate(viewId: string): Promise<void>
  currentView(): Promise<ViewSnapshot | null>
  listViews(): Promise<readonly ViewSnapshot[]>
  subscribeNavigation(callback: (view: ViewSnapshot | null) => void): () => void
  getDashboardContext(): Promise<DashboardContextSnapshot>
  emitAction(action: string, detail?: Record<string, unknown>): Promise<void>
}
```

Entity, view, and dashboard context values are immutable JSON snapshots. Subscriptions are
disposed when the returned function is called or when the iframe is destroyed.

## Capabilities

Calls are denied unless the card declares the matching capability:

| Capability | API methods |
|---|---|
| `entity:read` | `getEntity` |
| `entity:subscribe` | `subscribeEntity` |
| `icon:render` | `getIcon` |
| `service:call` | `callService` |
| `navigation:read` | `currentView`, `listViews`, `subscribeNavigation` |
| `navigation:write` | `navigate` |
| `dashboard:context` | `getDashboardContext` |
| `shell:events` | `emitAction` |

Configuration access does not require a capability because only the current instance values are
provided. Unknown actions and capabilities fail closed.

## Preview mode

Preview mode uses the same sandbox and validation path as runtime. Mutating capabilities are
disabled regardless of declarations: `service:call`, `navigation:write`, and `shell:events`.
The API returns a structured `preview_action_denied` error for those operations.

## Host responsibilities

The host must:

- validate entity IDs, icon names, service names, view IDs, payload shapes, and payload sizes;
- check administrator and dashboard permissions independently of card declarations;
- serialize HA data to fresh JSON-compatible snapshots;
- clean up subscriptions and pending requests when a card is removed;
- report runtime failures without exposing credentials or internal stack data;
- never treat card-generated HTML, labels, or errors as trusted markup.
