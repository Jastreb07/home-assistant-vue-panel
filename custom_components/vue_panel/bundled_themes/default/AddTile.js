export default function ({ vue, components }) {
  const { computed } = vue

  /** Tiles carry a larger glyph than inline pills at the same size. */
  const ICON_SIZE = { xs: 14, sm: 18, md: 22, lg: 26, xl: 30 }

  return {
    name: 'AddTile',
    components: { MdiIcon: components.MdiIcon },
    /**
     * Dashed "add something" affordance — used for cards, sections and
     * nav slots. Renders a plain button, so consumers just bind @click.
     */
    props: {
      label: { type: String, default: undefined },
      icon: { type: String, default: 'mdi:plus' },
      /** 'tile' = dashed block, 'pill' = rounded inline button */
      variant: { type: String, default: 'tile' },
      /** Icon above the label, or next to it */
      orientation: { type: String, default: 'vertical' },
      size: { type: String, default: 'md' },
      /** Grow to fill the available height (panel layout) */
      fill: { type: Boolean, default: false },
    },
    setup(props) {
      const iconSize = computed(() => {
        const base = ICON_SIZE[props.size]
        return props.orientation === 'vertical' ? base + 6 : base
      })
      return { iconSize }
    },
    template: `
  <button
    type="button"
    class="vp-add-tile"
    :class="[
      \`vp-add-tile--\${variant}\`,
      \`vp-add-tile--\${orientation}\`,
      \`vp-size-\${size}\`,
      { 'vp-add-tile--fill': fill },
    ]"
  >
    <MdiIcon :icon="icon" :size="iconSize" />
    <span v-if="label">{{ label }}</span>
  </button>
`,
  }
}
