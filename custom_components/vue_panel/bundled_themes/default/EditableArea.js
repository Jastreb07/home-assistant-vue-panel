export default function () {
  return {
    name: 'EditableArea',
    /**
     * Dashed edit-mode box with a floating toolbar — the shared chrome around
     * anything the dashboard editor lets you rearrange: view sections and bar
     * columns today, potentially more areas later.
     */
    props: {
      tag: { type: String, default: 'div' },
      editing: { type: Boolean, default: false },
      dragging: { type: Boolean, default: false },
      dropTarget: { type: Boolean, default: false },
    },
    template: `
  <component
    :is="tag"
    class="vp-editable-area"
    :class="{
      editing,
      dragging,
      'drop-target': dropTarget,
    }"
  >
    <div v-if="editing && $slots.toolbar" class="vp-editable-area-toolbar">
      <slot name="toolbar" />
    </div>
    <slot />
  </component>
`,
  }
}
