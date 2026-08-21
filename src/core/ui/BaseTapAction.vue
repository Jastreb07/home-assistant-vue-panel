<script setup lang="ts">
import { themed } from '@/theme/registry'
import type { SelectOption } from './selectMenu'
import type { CardAction, CardActionValue, CardGesture } from './cardActions'

/** Thin wrapper: renders the 'TapAction' component of the active theme. */
const TapAction = themed('TapAction')

defineProps<{
  modelValue: Partial<Record<CardGesture, CardActionValue>>
  gestures?: CardGesture[]
  actions?: CardAction[]
  viewOptions: SelectOption[]
  /** Popups the `popup` action can open */
  popupOptions?: SelectOption[]
  /** Dialog cards the `more-info` action may show */
  detailOptions?: SelectOption[]
}>()
const emit = defineEmits<{
  'update:modelValue': [value: Partial<Record<CardGesture, CardActionValue>>]
}>()
</script>

<template>
  <component
    :is="TapAction"
    :model-value="modelValue"
    :gestures="gestures"
    :actions="actions"
    :view-options="viewOptions"
    :popup-options="popupOptions"
    :detail-options="detailOptions"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
