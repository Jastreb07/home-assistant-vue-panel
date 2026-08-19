<script setup lang="ts">
import { themed } from '@/theme/registry'

/** Thin wrapper: renders the 'EditableArea' component of the active theme. */
const EditableArea = themed('EditableArea')

withDefaults(
  defineProps<{
    /** Root element tag — 'section' for a view section, 'div' for a bar column */
    tag?: string
    /** Shows the dashed edit-mode border and the toolbar slot */
    editing?: boolean
    /** This area is currently being dragged (reorder) */
    dragging?: boolean
    /** A dragged item would be dropped into this area */
    dropTarget?: boolean
  }>(),
  { tag: 'div' },
)
</script>

<template>
  <component :is="EditableArea" :tag="tag" :editing="editing" :dragging="dragging" :drop-target="dropTarget">
    <template v-if="$slots.toolbar" #toolbar>
      <slot name="toolbar" />
    </template>
    <slot />
  </component>
</template>
