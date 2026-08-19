# Vue Panel Card API v1

Status: normative capability and API contract for Card Format v2.

## Execution model

Every portable card runs embedded in the engine document so that the active theme's global
stylesheet applies to it. The engine injects the card markup into a scoped element, wraps the
card CSS in that scope through native CSS nesting, and runs the card script with a scoped
`document` (element lookups resolve inside the card) plus tracked timers and listeners that are
disposed with the card.

This is a styling and DOM boundary, not a security boundary: an embedded card shares the engine
origin and can reach the surrounding document. Only install cards you trust. The engine still
serves HA data as fresh JSON snapshots and validates entity IDs, icon names, service names, view
IDs, payload shapes, and the declared capability before performing an action.

## JavaScript API

The engine passes one frozen object into the card script as `vuePanel`:

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
disposed when the returned function is called or when the card is removed.

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

Preview mode uses the same runtime and validation path as a live card. Mutating capabilities are
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
