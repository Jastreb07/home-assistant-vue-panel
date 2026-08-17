<script setup lang="ts">
import type { ControlSize } from '@/core/ui/controlSize'

/** Text/number field sharing the control size scale with Button and SelectMenu. */
const props = withDefaults(
  defineProps<{
    modelValue: string | number
    type?: 'text' | 'number'
    size?: ControlSize
    placeholder?: string
    disabled?: boolean
    invalid?: boolean
    spellcheck?: boolean
    min?: number | string
    max?: number | string
    step?: number | string
    /** id of a <datalist> for native suggestions */
    list?: string
  }>(),
  { size: 'md', type: 'text' },
)
const emit = defineEmits<{ 'update:modelValue': [value: string | number] }>()

function onInput(e: Event) {
  const value = (e.target as HTMLInputElement).value
  emit('update:modelValue', props.type === 'number' ? Number(value) : value)
}
</script>

<template>
  <input
    class="vp-input"
    :class="`vp-size-${size}`"
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
  />
</template>
