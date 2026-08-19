<script setup lang="ts">
import { themed } from '@/theme/registry'
import type { ViewMoveDirection, ViewSelectOption } from './viewSelect'
import type { ControlSize } from './controlSize'

/** Thin wrapper: renders the 'ViewSelectMenu' component of the active theme. */
const ViewSelectMenu = themed('ViewSelectMenu')

defineProps<{
  /** Id of the active view */
  modelValue: string
  /** Views in their stored order — index 0 is the default view */
  views: ViewSelectOption[]
  /** Field size — shares the scale with Button and Input */
  size?: ControlSize
  /** Show a search field — helpful for long view lists */
  searchable?: boolean
  /** Offer the reorder arrows */
  reorderable?: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [viewId: string]
  move: [viewId: string, direction: ViewMoveDirection]
}>()

function onMove(viewId: string, direction: ViewMoveDirection): void {
  emit('move', viewId, direction)
}
</script>

<template>
  <component
    :is="ViewSelectMenu"
    :model-value="modelValue"
    :views="views"
    :size="size"
    :searchable="searchable"
    :reorderable="reorderable"
    @update:model-value="emit('update:modelValue', $event)"
    @move="onMove"
  />
</template>
