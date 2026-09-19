export default function ({ vue, components }) {
  const { ref } = vue

  return {
    name: 'CollapsibleAdvanced',
    components: { MdiIcon: components.MdiIcon },
    props: {
      title: { type: String, required: true },
      /** Readable name shown in brackets behind the technical title */
      subtitle: { type: String, default: undefined },
      marker: { type: [String, Number], default: undefined },
      defaultOpen: { type: Boolean, default: false },
      removeLabel: { type: String, required: true },
    },
    emits: ['remove'],
    setup(props, { emit }) {
      const open = ref(props.defaultOpen)
      return { open, emit }
    },
    template: `
  <section class="vp-variable-card" :class="{ open }">
    <header class="vp-variable-card-head">
      <button
        type="button"
        class="vp-variable-card-toggle"
        :aria-expanded="open"
        @click="open = !open"
      >
        <MdiIcon icon="mdi:chevron-right" class="vp-variable-card-chevron" :size="18" />
        <span v-if="marker !== undefined" class="vp-variable-card-marker">{{ marker }}</span>
        <code class="vp-variable-card-title">{{ title }}</code>
        <span v-if="subtitle" class="vp-variable-card-subtitle">({{ subtitle }})</span>
      </button>
      <button
        type="button"
        class="vp-variable-card-remove"
        :aria-label="removeLabel"
        :title="removeLabel"
        @click="emit('remove')"
      >
        <MdiIcon icon="mdi:delete-outline" :size="17" />
      </button>
    </header>
    <div v-show="open" class="vp-variable-card-body">
      <slot />
    </div>
  </section>
`,
  }
}
