export default function () {
  return {
    name: 'Input',
    /** Text/number field sharing the control size scale with Button and SelectMenu. */
    props: {
      modelValue: { type: [String, Number], required: true },
      type: { type: String, default: 'text' },
      size: { type: String, default: 'md' },
      placeholder: { type: String, default: undefined },
      disabled: { type: Boolean, default: false },
      invalid: { type: Boolean, default: false },
      spellcheck: { type: Boolean, default: false },
      min: { type: [Number, String], default: undefined },
      max: { type: [Number, String], default: undefined },
      step: { type: [Number, String], default: undefined },
      /** id of a <datalist> for native suggestions */
      list: { type: String, default: undefined },
    },
    emits: ['update:modelValue', 'blur'],
    setup(props, { emit }) {
      function onInput(e) {
        const value = e.target.value
        emit('update:modelValue', props.type === 'number' && value !== '' ? Number(value) : value)
      }
      return { onInput, emit }
    },
    template: `
  <input
    class="vp-input"
    :class="\`vp-size-\${size}\`"
    :value="modelValue"
    :type="type"
    :placeholder="placeholder"
    :disabled="disabled"
    :aria-invalid="invalid || undefined"
    :spellcheck="spellcheck"
    :min="min"
    :max="max"
    :step="step"
    :list="list"
    @input="onInput"
    @blur="emit('blur', $event)"
  />
`,
  }
}
