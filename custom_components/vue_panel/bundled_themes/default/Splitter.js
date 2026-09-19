export default function ({ vue }) {
  const { ref } = vue

  return {
    name: 'Splitter',
    /**
     * Draggable divider between two columns of a grid. It reports the share of
     * the container the left column should take, in percent — the layout itself
     * stays the business of the dialog around it.
     */
    props: {
      share: { type: Number, required: true },
      /** Smallest width in px either side may shrink to */
      minPane: { type: Number, default: 260 },
      label: { type: String, default: undefined },
    },
    emits: ['update:share', 'update:dragging'],
    setup(props, { emit }) {
      const root = ref(null)
      const dragging = ref(false)

      function container() {
        const parent = root.value ? root.value.parentElement : null
        const bounds = parent ? parent.getBoundingClientRect() : null
        return bounds && bounds.width > 0 ? bounds : null
      }

      /** Both panes keep their minimum width, whatever the pointer says. */
      function apply(value) {
        const box = container()
        const width = box ? box.width : 1000
        const minimum = Math.min(45, props.minPane / width * 100)
        const maximum = Math.max(minimum, (width - props.minPane - 34) / width * 100)
        emit('update:share', Math.round(Math.min(maximum, Math.max(minimum, value)) * 10) / 10)
      }

      function applyFromPointer(clientX) {
        const bounds = container()
        if (bounds) apply((clientX - bounds.left) / bounds.width * 100)
      }

      function start(event) {
        dragging.value = true
        emit('update:dragging', true)
        event.currentTarget.setPointerCapture(event.pointerId)
        applyFromPointer(event.clientX)
      }

      function move(event) {
        if (dragging.value) applyFromPointer(event.clientX)
      }

      function stop(event) {
        dragging.value = false
        emit('update:dragging', false)
        const target = event.currentTarget
        if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId)
      }

      function resizeWithKeyboard(event) {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        if (event.key === 'Home') apply(30)
        else if (event.key === 'End') apply(70)
        else apply(props.share + (event.key === 'ArrowRight' ? 2 : -2))
      }

      return { root, dragging, start, move, stop, resizeWithKeyboard }
    },
    template: `
  <div
    ref="root"
    class="vp-splitter"
    :class="{ 'is-dragging': dragging }"
    role="separator"
    aria-orientation="vertical"
    :aria-label="label"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuenow="Math.round(share)"
    tabindex="0"
    @keydown="resizeWithKeyboard"
    @pointerdown.prevent="start"
    @pointermove.prevent="move"
    @pointerup="stop"
    @pointercancel="stop"
  >
    <span />
  </div>
`,
  }
}
