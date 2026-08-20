<script setup lang="ts">
import { themed } from '@/theme/registry'
import type { ViewMoveDirection, ViewSelectOption } from './viewSelect'
import type { ControlSize } from './controlSize'

/** Thin wrapper: renders the 'ViewSelectMenu' component of the active theme. */
const ViewSelectMenu = themed('ViewSelectMenu')

const props = withDefaults(
  defineProps<{
    /** Id of the active view */
    modelValue: string
    /** Views in their stored order — index 0 is the default view */
    views: ViewSelectOption[]
    /** Field size — shares the scale with Button and Input */
    size?: ControlSize
    /** Show a search field — helpful for long view lists */
    searchable?: boolean
    /**
     * Offer the reorder arrows and the drag handle. The default must live here
     * as well: Vue casts an omitted Boolean prop to `false`, and this wrapper
     * would otherwise forward that `false` and override the theme's default.
     */
    reorderable?: boolean
  }>(),
  { size: 'md', reorderable: true },
)
const emit = defineEmits<{
  'update:modelValue': [viewId: string]
  move: [viewId: string, direction: ViewMoveDirection]
  reorder: [viewId: string, toIndex: number]
}>()

function onMove(viewId: string, direction: ViewMoveDirection): void {
  emit('move', viewId, direction)
}

function onReorder(viewId: string, toIndex: number): void {
  emit('reorder', viewId, toIndex)
}
</script>

<template>
  <component
    :is="ViewSelectMenu"
    :model-value="modelValue"
    :views="views"
    :size="props.size"
    :searchable="searchable"
    :reorderable="props.reorderable"
    @update:model-value="emit('update:modelValue', $event)"
    @move="onMove"
    @reorder="onReorder"
  />
</template>
