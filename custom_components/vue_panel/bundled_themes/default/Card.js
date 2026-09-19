export default function () {
  return {
    name: 'Card',
    props: {
      /** Visually highlight the card (e.g. light on) */
      active: { type: Boolean, default: false },
      clickable: { type: Boolean, default: false },
    },
    template: `
  <div class="vp-card" :class="{ active, clickable }">
    <slot />
  </div>
`,
  }
}
