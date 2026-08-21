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
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
