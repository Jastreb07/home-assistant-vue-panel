<script setup lang="ts">
import { themed } from '@/theme/registry'
import type { SelectOption } from './selectMenu'

/** Thin wrapper: renders the 'SelectMenu' component of the active theme. */
const SelectMenu = themed('SelectMenu')

defineProps<{
  modelValue: string
  options: SelectOption[]
  /** Show a search field — for long lists */
  searchable?: boolean
  /** Offer an ✕ button that resets the value to '' */
  clearable?: boolean
  /** Accept free text that matches no option (search field only) */
  allowCustom?: boolean
  /** Prepended to free text when missing, e.g. 'mdi:' */
  customPrefix?: string
  /** Shown while no value is set */
  placeholder?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <component
    :is="SelectMenu"
    :model-value="modelValue"
    :options="options"
    :searchable="searchable"
    :clearable="clearable"
    :allow-custom="allowCustom"
    :custom-prefix="customPrefix"
    :placeholder="placeholder"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
