export default function ({ vue, useI18n, components, helpers }) {
  const { computed } = vue
  const { boxSides, boxUnits } = helpers

  /**
   * Four-sided value editor (padding, margin, …): one field per side plus a
   * unit picker and a chain button that keeps all sides in sync.
   */
  return {
    name: 'BoxInput',
    components: {
      MdiIcon: components.MdiIcon,
      BaseButton: components.BaseButton,
      BaseInput: components.BaseInput,
      BaseSelectMenu: components.BaseSelectMenu,
    },
    props: {
      modelValue: { type: Object, default: undefined },
      label: { type: String, default: undefined },
      /** Lowest accepted number — margins may be negative, paddings not */
      min: { type: Number, default: 0 },
    },
    emits: ['update:modelValue'],
    setup(props, { emit }) {
      const { t } = useI18n()

      const box = computed(() => props.modelValue ?? {})
      const unit = computed(() => box.value.unit ?? 'px')
      const linked = computed(() => box.value.linked === true)

      const unitOptions = computed(() => boxUnits.map((u) => ({ value: u, label: u })))

      function fieldValue(side) {
        const v = box.value[side]
        return v === undefined || v === null ? '' : v
      }

      function onSideInput(side, raw) {
        const value = raw === '' ? undefined : Number(raw)
        if (value !== undefined && !Number.isFinite(value)) return
        const next = { ...box.value }
        if (linked.value) {
          for (const s of boxSides) next[s] = value
        } else {
          next[side] = value
        }
        emit('update:modelValue', next)
      }

      function onUnitChange(value) {
        emit('update:modelValue', { ...box.value, unit: value })
      }

      /** Turning the chain on levels all sides to the first one that has a value. */
      function toggleLink() {
        const next = { ...box.value, linked: !linked.value }
        if (next.linked) {
          const first = boxSides.map((s) => box.value[s]).find((v) => v !== undefined && v !== null)
          for (const s of boxSides) next[s] = first
        }
        emit('update:modelValue', next)
      }

      return { t, boxSides, unit, linked, unitOptions, fieldValue, onSideInput, onUnitChange, toggleLink }
    },
    template: `
  <div class="vp-box vp-size-sm">
    <div class="vp-box-head">
      <span class="vp-box-label">{{ label }}</span>
      <div class="vp-box-unit">
        <BaseSelectMenu :model-value="unit" :options="unitOptions" size="xs" @update:model-value="onUnitChange" />
      </div>
    </div>

    <div class="vp-box-row">
      <label v-for="side in boxSides" :key="side" class="vp-box-cell">
        <BaseInput
          class="vp-box-input"
          type="number"
          size="sm"
          :min="min"
          :model-value="fieldValue(side)"
          @update:model-value="onSideInput(side, String($event))"
        />
        <small class="vp-box-side">{{ t('editor.box.' + side) }}</small>
      </label>

      <BaseButton
        type="button"
        class="vp-box-link"
        :variant="linked ? 'primary' : 'default'"
        size="sm"
        :title="t(linked ? 'editor.box.unlink' : 'editor.box.link')"
        @click="toggleLink"
      >
        <MdiIcon :icon="linked ? 'mdi:link-variant' : 'mdi:link-variant-off'" :size="16" />
      </BaseButton>
    </div>
  </div>
    `,
  }
}
