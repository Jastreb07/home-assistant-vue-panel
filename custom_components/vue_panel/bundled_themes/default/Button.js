export default function () {
  return {
    name: 'Button',
    props: {
      variant: { type: String, default: undefined },
      disabled: { type: Boolean, default: false },
      /** Shares the scale with Input and SelectMenu */
      size: { type: String, default: 'md' },
    },
    template: `
  <button class="vp-btn" :class="[variant, \`vp-size-\${size}\`]" :disabled="disabled">
    <slot />
  </button>
`,
  }
}
