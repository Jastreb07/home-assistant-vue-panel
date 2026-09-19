export default function ({ components }) {
  return {
    name: 'Checkbox',
    components: { MdiIcon: components.MdiIcon },
    /**
     * Checkbox with a styled box instead of the native control. The real
     * <input> stays in the DOM (visually hidden) so keyboard, focus and
     * form semantics keep working.
     */
    props: {
      modelValue: { type: Boolean, required: true },
      disabled: { type: Boolean, default: false },
      /** Optional text next to the box */
      label: { type: String, default: undefined },
    },
    emits: ['update:modelValue'],
    setup(props, { emit }) {
      return { emit }
    },
    template: `
  <label class="vp-checkbox" :class="{ disabled }">
    <input
      class="vp-checkbox-input"
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      @change="emit('update:modelValue', $event.target.checked)"
    />
    <span class="vp-checkbox-box" :class="{ checked: modelValue }">
      <MdiIcon v-if="modelValue" icon="mdi:check" :size="16" />
    </span>
    <span v-if="label" class="vp-checkbox-label">{{ label }}</span>
  </label>
`,
  }
}
