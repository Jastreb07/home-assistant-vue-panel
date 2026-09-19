# Vue Panel Theme Format v1

A theme is a plain directory of files managed by the integration. Themes are
never compiled into the engine — they are read at runtime, so installing a
theme means copying a folder.

## Locations

- Bundled themes ship read-only inside the integration package under
  `custom_components/vue_panel/bundled_themes/<name>/`. The `default` theme
  always exists and is the fallback for everything.
- User themes live under `<config>/vue-panel/themes/<name>/`. The directory
  name is the theme's stable identity (lowercase slug) and is what the
  dashboard settings store in `settings.uiTheme`. A local theme with the same
  name as a bundled theme overrides it.

The engine loads themes through the authenticated WebSocket commands
`vue_panel/themes/list` (catalog with metadata) and `vue_panel/themes/get`
(all files of one theme).

## Files

```
<name>/
  main.css        required — every style of the theme plus the metadata header
  <Component>.js  optional — runtime component overrides, flat in the root
  <anything>.css  optional — extra stylesheets referenced by a component
```

There are no per-component folders. All CSS belongs in the single `main.css`;
a component module may alternatively declare where its own CSS lives (see
below). Styles use namespaced classes (`vp-card`, `vp-dialog`, `vp-btn`, …)
instead of scoped CSS so that CSS-only themes can override the default markup.

## Metadata header

`main.css` must start with a comment header. Recognized fields:

```css
/*
Theme Name:        My Theme
Description:       Short human readable description.
Version:           1.0.0
Author:            Jane Doe
Requires Vue Panel: 2.3.0
*/
```

`Requires Vue Panel` is the minimum Vue Panel (integration) version the theme
needs. The integration compares it against its own version and marks older
installations as incompatible; incompatible themes cannot be activated and the
engine falls back to the default theme.

## Component modules

A component override is a flat ES module named after the component it
replaces (`Card.js`, `Dialog.js`, `SelectMenu.js`, …). It must not import
anything — every dependency is handed to its factory:

```js
// Optional: this component's CSS lives outside main.css.
// A string or an array of file names inside the theme directory.
export const styles = 'Card.css'

export default function ({ vue, useI18n, components, helpers }) {
  const { computed } = vue
  return {
    name: 'Card',
    components: { MdiIcon: components.MdiIcon },
    props: {
      title: { type: String, default: '' },
    },
    emits: ['close'],
    setup(props, { emit }) {
      const label = computed(() => props.title || '—')
      return { label }
    },
    template: `
      <section class="vp-card">
        <header>{{ label }}</header>
        <slot />
      </section>
    `,
  }
}
```

The factory receives one API object and returns standard Vue component
options. Templates are strings and are compiled at runtime by the engine.

### The factory API

- `vue` — the complete Vue runtime namespace (`ref`, `computed`, `watch`,
  `onMounted`, `nextTick`, `useId`, …).
- `useI18n` — vue-i18n's composable for translated labels.
- `components` — engine components for use inside templates: `MdiIcon` plus
  every base wrapper (`BaseButton`, `BaseInput`, `BaseSelectMenu`,
  `BaseCollapsible`, `BaseDialog`, …). Wrappers resolve through the theme
  system, so composing them inside a theme keeps the fallback chain intact.
- `helpers` — engine utilities:
  - `useDashboardStore()`, `useMediaQuery(query)`, `dialogPointerPosition()`
  - `boxSides`, `boxUnits` (box input)
  - `isParentView`, `viewDepth` (view select)
  - `defaultColor`, `parseColor`, `formatColor`, `toCss`, `rgbToHsv`,
    `hsvToRgb` (color picker)
  - `CARD_GESTURES`, `CARD_ACTION_OPTIONS`, `GESTURE_ICONS`, `actionTarget`
    (tap action editor)
  - `lintCss(source)` and `loadCodeMirror()` — the latter resolves the full
    CodeMirror toolkit on demand (code editor)

## Resolution rules

1. The default theme's `main.css` is always injected first.
2. The active theme's `main.css` is injected on top.
3. `themed('<Name>')` resolves to the active theme's `<Name>.js` when the file
   exists, otherwise to the default theme's `<Name>.js`.
4. Component modules exporting `styles` get those stylesheets injected once on
   first use.

A theme therefore only contains what it changes: a pure CSS theme is a single
`main.css`; a component override adds one flat `.js` file.

## Themeable components

AddTile, BoxInput, Button, Card, CardEditOverlay, Checkbox, CodeEditor,
Collapsible, CollapsibleAdvanced, ColorPicker, Dialog, EditableArea,
EditableAreaButton, Input, SelectMenu, Splitter, Tabs, TapAction,
ViewSelectMenu.
