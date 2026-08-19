<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import MdiIcon from '@/core/ui/MdiIcon.vue'
import BaseButton from '@/core/ui/BaseButton.vue'
import BaseInput from '@/core/ui/BaseInput.vue'
import BaseSelectMenu from '@/core/ui/BaseSelectMenu.vue'
import { boxSides, boxUnits, type BoxSide, type BoxUnit, type BoxValue } from '@/core/ui/boxInput'

/**
 * Four-sided value editor (padding, margin, …): one field per side plus a
 * unit picker and a chain button that keeps all sides in sync.
 */
const props = withDefaults(
  defineProps<{
    modelValue?: BoxValue
    label?: string
    /** Lowest accepted number — margins may be negative, paddings not */
    min?: number
  }>(),
  { min: 0 },
)
const emit = defineEmits<{ 'update:modelValue': [value: BoxValue] }>()

const { t } = useI18n()

const box = computed<BoxValue>(() => props.modelValue ?? {})
const unit = computed(() => box.value.unit ?? 'px')
const linked = computed(() => box.value.linked === true)

const unitOptions = computed(() => boxUnits.map((u) => ({ value: u, label: u })))

function fieldValue(side: BoxSide): string | number {
  const v = box.value[side]
  return v === undefined || v === null ? '' : v
}

function onSideInput(side: BoxSide, raw: string) {
  const value = raw === '' ? undefined : Number(raw)
  if (value !== undefined && !Number.isFinite(value)) return
  const next: BoxValue = { ...box.value }
  if (linked.value) {
    for (const s of boxSides) next[s] = value
  } else {
    next[side] = value
  }
  emit('update:modelValue', next)
}

function onUnitChange(value: string) {
  emit('update:modelValue', { ...box.value, unit: value as BoxUnit })
}

/** Turning the chain on levels all sides to the first one that has a value. */
function toggleLink() {
  const next: BoxValue = { ...box.value, linked: !linked.value }
  if (next.linked) {
    const first = boxSides.map((s) => box.value[s]).find((v) => v !== undefined && v !== null)
    for (const s of boxSides) next[s] = first
  }
  emit('update:modelValue', next)
}
</script>

<template>
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
</template>
