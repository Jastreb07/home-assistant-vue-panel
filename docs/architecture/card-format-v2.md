# Vue Panel Card Format v2

Status: normative contract for the greenfield integration architecture.

## Identity and file location

Every card is identified by the immutable pair `manufacturer/cardName`. Both values must match
`^[a-z0-9]+(?:-[a-z0-9]+)*$`. The backend derives the private file location and never accepts a
path supplied by the document:

```text
<config>/vue-panel/cards/<manufacturer>/<cardName>.html
```

`vue-panel` is reserved for integration-managed core cards shipped inside the integration.
Browser-created cards default to `local`. Editable card content is transferred through the
authenticated WebSocket API and rendered by the embedded card runtime; its private filesystem
path is not exposed as a static URL. A display name is mutable and never changes the identity or file path.

## Document structure

A card is one UTF-8 HTML document with exactly one block of each required type, in this order:

```html
<script data-vue-panel-config>
const vuePanelCard = {
  "format": "vue-panel-card",
  "formatVersion": 2,
  "apiVersion": 1,
  "manufacturer": "example-manufacturer",
  "cardName": "example-tile",
  "name": "Example tile",
  "description": "A minimal dashboard tile",
  "icon": "mdi:view-dashboard-outline",
  "group": "example-manufacturer",
  "areas": ["dashboard"],
  "capabilities": ["entity:read", "entity:subscribe", "icon:render"],
  "defaultSize": { "cols": 1, "rows": 1, "width": 140, "height": 120 },
  "defaultResponsive": {
    "mobile": true,
    "tablet": true,
    "desktop": true,
    "mobileMax": 767,
    "tabletMax": 1023
  },
  "fullRow": false,
  "variables": []
};
</script>

<script data-vue-panel-translation>
const vuePanelTranslations = {
  "fallback": "en",
  "languages": {
    "en": { "translation.name": "Example tile" },
    "de": { "translation.name": "Beispiel-Kachel" }
  }
};
</script>

<template data-vue-panel-html>
  <article class="example-tile"></article>
</template>

<style data-vue-panel-css>
.example-tile { width: 100%; height: 100%; }
</style>

<script data-vue-panel-javascript>
const config = vuePanel.config;
</script>
```

The configuration block has JavaScript syntax for editor readability, but its value must be a
JSON-compatible object literal assigned to the single top-level constant `vuePanelCard`. It must
not contain expressions, functions, comments inside values, computed keys, references, or other
statements. Import validation parses this restricted form without executing it. The translation
block follows the same restricted form for its own constant, `vuePanelTranslations`.

## Translations

The optional `<script data-vue-panel-translation>` block holds every user-facing text of a card:

- `languages`: one flat catalog per language. Any BCP-47-style tag is allowed (`en`, `de`, `fr`,
  `pt-BR`, …) — a card may ship languages the panel UI itself does not speak, up to 40 of them;
- every catalog key must match `translation.<segment>[.<segment>…]`;
- `fallback`: the language single missing texts fall back to. It must be one of the card's own
  languages; a card without a `fallback` always falls back to English.

Resolution order for one key is: the language the panel currently runs in, then a regional variant
of it the card ships (`pt-BR` answers a panel running in `pt`), then the card's `fallback`
language, then English. A key that is missing — or translated to an empty string —
everywhere in that chain is rendered as the technical key itself (for example `translation.name`),
so untranslated text is visible instead of silently blank.

Any metadata or variable string may be a `translation.*` key instead of literal text: `name`,
`description`, variable `label`, variable `group`, `optionLabels` values, and the `label` of a
list item field. Strings that do not start with `translation.` stay literal. Card code reads its
own texts through `vuePanel.t('translation.…')` (see `sandbox-api-v1.md`).

## Metadata

Required metadata:

- `format`: exactly `vue-panel-card`;
- `formatVersion`: exactly `2`;
- `apiVersion`: card API major version required by the card;
- `manufacturer` and `cardName`: immutable identity;
- `name`, `description`, `icon`, and `group`: picker metadata;
- `areas`: one or more of `dashboard`, `sidebar`, `header`, `bottom`, `dialog`;
- `capabilities`: explicit card API permissions;
- `defaultSize`: positive `cols`, `rows`, `width`, and `height` values;
- `defaultResponsive`: device defaults and ordered breakpoints;
- `fullRow`: whether the card always spans its container;
- `variables`: generated configuration schema.

Optional metadata:

- `detail`: the detail view opened by the `more-info` tap action.

The supported API v1 capabilities are defined in `sandbox-api-v1.md` (Card API v1). Unknown capabilities or a
newer API major version make a card incompatible instead of silently granting access.

## Dialog cards and the detail view

Cards with the area `dialog` are not placed on a dashboard. They fill a custom popup or the detail view of
an entity. Both hand the values of the triggering card to every card inside the dialog: they arrive as
`vuePanel.context` and can be referenced from any instance value with `${variableKey}`.

The optional `detail` block declares which dialog card the `more-info` tap action of this card opens:

```json
"detail": {
  "card": "vue-panel/light-detail",
  "entityKey": "entity",
  "variables": ["entity", "name", "icon"]
}
```

- `card`: dialog card to render — omit it to use the domain default;
- `entityKey`: variable holding the entity the detail view belongs to (default `entity`);
- `variables`: values handed over — omit it to hand over all of them.

The engine resolves the detail view in this order: the target configured on the tap action, the card's own
`detail.card`, the domain default `vue-panel/<domain>-detail` when the catalog ships it, and finally a
built-in dialog listing name, state, and attributes. Opening popups or detail views requires the
`dialog:open` capability.

## Variables

Each variable is an object with these common fields:

```json
{
  "key": "entity",
  "label": "Entity",
  "type": "entity",
  "required": true,
  "default": ""
}
```

Rules:

- `key` must match `^[A-Za-z_$][A-Za-z0-9_$]*$` and be unique within the card;
- `label` is user-facing text;
- `group` is optional user-facing text: the settings dialog puts all variables of one group into
  one collapsed box, ungrouped variables share a fallback box, and `entity` variables are always
  shown above the boxes;
- `type` is one of `entity`, `icon`, `view`, `select`, `string`, `number`, `boolean`, `list`, `action`;
- `visibleIf` is optional and hides the variable in the settings dialog until other variables of
  the same card match. One condition, or an array of conditions that all have to hold, each with a
  `key` and exactly one matcher — `equals`, `not` or a non-empty `in` array:

  ```json
  { "key": "attribute", "visibleIf": { "key": "showAttribute", "equals": true } }
  ```

  A referenced key must exist in the same card (inside `itemFields`: in the same item fields).
  Conditions only drive the editor — a hidden variable keeps its stored value and stays readable
  through `vuePanel.config`;
- `required` is always explicit;
- `default` must match the variable type when present and is rejected for `list`;
- `entity` may define a lowercase `domain`;
- `select` must define a non-empty `options` array and may define `optionLabels`;
- `number` may define finite `min`, `max`, and `step` values;
- `list` must define a non-empty `itemFields` array (at most 24 scalar variables, no nested
  lists) and may set `nestable` to allow indented entries.

### Tap actions

A variable of type `action` is rendered by the panel, not by the card: it offers a tap, double tap
and hold action and — depending on the chosen action — the matching target field (a view picker for
`navigate`, a URL field for `url`, a `domain.action` field for `perform-action`). A card only
narrows the choices down:

```json
{
  "key": "actions",
  "label": "translation.variables.actions.label",
  "type": "action",
  "required": false,
  "gestures": ["tap", "hold"],
  "actions": ["default", "toggle", "navigate"],
  "default": { "tap": { "action": "toggle" } }
}
```

`gestures` and `actions` are optional — without them every gesture (`tap`, `double_tap`, `hold`)
and every action (`default`, `more-info`, `ha-more-info`, `toggle`, `navigate`, `url`,
`perform-action`, `popup`, `assist`, `none`) is offered. `more-info` opens Vue Panel's detail
view, while `ha-more-info` asks the surrounding Home Assistant frontend to show its native
more-info dialog for the card's entity. The stored value is one entry per gesture:

```json
{ "tap": { "action": "navigate", "target": "living-room" } }
```

`default` uses the same shape and is the only variable type whose default is an object. `default`
as an action means "whatever the card does by itself". For `hold` a card usually does nothing on
its own, so the bundled cards fall back to the automatic detail view of the card's entity — a
plain `hold` slot therefore behaves like `more-info` without a target. `ha-more-info` has no
target field because the card supplies its configured entity. `assist` is not implemented.

A `list` stores an array of objects. Every entry carries its own `id`, a `depth` (0–2, only used
when `nestable` is true) and one value per item field:

```json
{
  "key": "items",
  "label": "Menu entries",
  "type": "list",
  "required": false,
  "nestable": true,
  "itemFields": [
    { "key": "label", "label": "Label", "type": "string", "required": false },
    { "key": "icon", "label": "Icon", "type": "icon", "required": false },
    { "key": "view", "label": "Target view", "type": "view", "required": false }
  ]
}
```

The generated editor is a WordPress-style builder: add, reorder, indent, edit and delete entries.
It reads three conventions from the item fields — the first `string` field is the row label, the
first `icon` field the row icon, and the first `view` field the navigation target. With a `view`
field present the editor also offers "add view" and "add all views" shortcuts, and entries without
a target are marked as headings.

Instance values are exposed read-only through `vuePanel.config`. Card source code is never copied
into an individual dashboard card instance.

## Managed and editable cards

Files under `custom_components/vue_panel/bundled_cards/vue-panel/` are integration-managed and
read-only. They can be duplicated to a new identity before editing. Other manufacturer
directories live under `<config>/vue-panel/cards/` and may be edited externally or through the
authenticated admin API. Import and update operations reject identity changes; changing the
identity creates a different card.

## Validation and execution

The integration validates structure, metadata, identity, declared API version, capabilities, and
the server-derived destination before writing a file. A card is rendered only after validation.
HTML, CSS, and runtime JavaScript execute in the embedded card runtime described by Card API v1:
the card CSS is scoped to the card element, the theme's global stylesheet applies, and the script
receives the capability-checked `vuePanel` API.
