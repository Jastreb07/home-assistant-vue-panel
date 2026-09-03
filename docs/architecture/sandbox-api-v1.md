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
  readonly context: Readonly<Record<string, unknown>>
  readonly language: string
  t(key: string): string
  getEntity(entityId: string): Promise<EntitySnapshot | null>
  getEntityAreas(entityIds: readonly string[]): Promise<
    Readonly<Record<string, Readonly<{ id: string; name: string; icon?: string }> | null>>
  >
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
  showDetail(options?: {
    card?: string
    entity?: string
    variables?: readonly string[]
    context?: Record<string, unknown>
    position?: 'top' | 'center' | 'bottom'
    mobileHeight?: 'full' | 'fit-content'
  }): Promise<null>
  closeDialog(): Promise<null>
  showNativeDetail(entityId: string): Promise<null>
  openPopup(popupId: string, context?: Record<string, unknown>): Promise<null>
}
```

Entity, view, and dashboard context values are immutable JSON snapshots. Subscriptions are
disposed when the returned function is called or when the card is removed.
`getEntityAreas()` resolves at most 100 explicitly requested entity IDs through Home Assistant's
entity, device, and area registries. An entity-level area overrides its device area; unassigned
entities map to `null`.

`context` holds the values the surrounding popup or detail view was opened with and is an empty
object for a card on a dashboard. The same values also replace `${variableKey}` placeholders in the
card's own instance values before `config` is frozen: a value that is exactly one placeholder keeps
the original type, mixed text is interpolated as a string, and unknown keys stay untouched.

`showDetail()` opens the detail view of this card: the requested `card`, otherwise the card's own
`detail.card`, otherwise the default card of the entity's domain, otherwise a built-in dialog.
`context` adds immutable values that apply only to this opening; they override selected instance
variables, while the resolved entity always remains authoritative.
Detail content is centered by default; `position` overrides it for one opening.
On mobile, detail dialogs use `fit-content` by default; `mobileHeight` can request a full-screen
dialog instead.
`closeDialog()` closes the popup or detail view containing the card and fails when called by a
card that is not currently rendered inside a dialog.
`showNativeDetail()` forwards the entity ID to the integration loader, which dispatches Home
Assistant's `hass-more-info` event in the host document. It is unavailable in standalone preview.
`openPopup()` opens a popup defined in the dashboard and hands over all instance values unless an
explicit context object is passed.

## Capabilities

Calls are denied unless the card declares the matching capability:

| Capability | API methods |
|---|---|
| `entity:read` | `getEntity`, `getEntityAreas` |
| `entity:subscribe` | `subscribeEntity` |
| `icon:render` | `getIcon` |
| `service:call` | `callService` |
| `navigation:read` | `currentView`, `listViews`, `subscribeNavigation` |
| `navigation:write` | `navigate` |
| `dashboard:context` | `getDashboardContext` |
| `shell:events` | `emitAction` |
| `dialog:open` | `showDetail`, `closeDialog`, `showNativeDetail`, `openPopup` |

Configuration access does not require a capability because only the current instance values are
provided. The same holds for `language` and `t()`: they only expose the card's own translation
block (see `card-format-v2.md`). `t()` resolves a `translation.*` key against the active language,
then the card's fallback language, then English, and returns the key itself when the text is
missing everywhere. Cards are re-rendered when the panel language changes, so `t()` may be called
during rendering. Unknown actions and capabilities fail closed.

## Preview mode

Preview mode uses the same runtime and validation path as a live card. Mutating capabilities are
disabled regardless of declarations: `service:call`, `navigation:write`, `shell:events`, and
`dialog:open`.
The API returns a structured `preview_action_denied` error for those operations.

## Host responsibilities

The host must:

- validate entity IDs, icon names, service names, view IDs, payload shapes, and payload sizes;
- check administrator and dashboard permissions independently of card declarations;
- serialize HA data to fresh JSON-compatible snapshots;
- clean up subscriptions and pending requests when a card is removed;
- report runtime failures without exposing credentials or internal stack data;
- never treat card-generated HTML, labels, or errors as trusted markup.
