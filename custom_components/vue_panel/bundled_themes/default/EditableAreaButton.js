export default function () {
  return {
    name: 'EditableAreaButton',
    props: {
      variant: { type: String, default: 'default' },
    },
    template: `
  <button type="button" class="vp-editable-area-btn" :class="\`vp-editable-area-btn--\${variant}\`">
    <slot />
  </button>
`,
  }
}
