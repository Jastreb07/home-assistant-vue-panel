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
statements. Import validation parses this restricted form without executing it.

## Metadata

Required metadata:

- `format`: exactly `vue-panel-card`;
- `formatVersion`: exactly `2`;
- `apiVersion`: card API major version required by the card;
- `manufacturer` and `cardName`: immutable identity;
- `name`, `description`, `icon`, and `group`: picker metadata;
- `areas`: one or more of `dashboard`, `sidebar`, `header`, `bottom`;
- `capabilities`: explicit card API permissions;
- `defaultSize`: positive `cols`, `rows`, `width`, and `height` values;
- `defaultResponsive`: device defaults and ordered breakpoints;
- `fullRow`: whether the card always spans its container;
- `variables`: generated configuration schema.

The supported API v1 capabilities are defined in `sandbox-api-v1.md` (Card API v1). Unknown capabilities or a
newer API major version make a card incompatible instead of silently granting access.

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
- `type` is one of `entity`, `icon`, `view`, `select`, `string`, `number`, `boolean`;
- `required` is always explicit;
- `default` must match the variable type when present;
- `entity` may define a lowercase `domain`;
- `select` must define a non-empty `options` array and may define `optionLabels`;
- `number` may define finite `min`, `max`, and `step` values.

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
