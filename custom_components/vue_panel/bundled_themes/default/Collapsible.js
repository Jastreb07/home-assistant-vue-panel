export default function ({ vue, components }) {
  const { ref } = vue

  return {
    name: 'Collapsible',
    components: { MdiIcon: components.MdiIcon },
    /** Collapsible box — groups related settings under a clickable header. */
    props: {
      title: { type: String, required: true },
      /** Optional mdi icon in front of the title */
      icon: { type: String, default: undefined },
      /** Start expanded — collapsed by default, so only the lead box is open */
      defaultOpen: { type: Boolean, default: false },
    },
    setup(props) {
      const open = ref(props.defaultOpen)
      return { open }
    },
    template: `
  <section class="vp-collapsible" :class="{ open }">
    <button
      type="button"
      class="vp-collapsible-head"
      :aria-expanded="open"
      @click="open = !open"
    >
      <MdiIcon icon="mdi:chevron-right" class="vp-collapsible-chevron" :size="18" />
      <MdiIcon v-if="icon" :icon="icon" :size="16" />
      <span class="vp-collapsible-title">{{ title }}</span>
    </button>
    <div v-show="open" class="vp-collapsible-body">
      <slot />
    </div>
  </section>
`,
  }
}
