<script setup lang="ts">
/**
 * Dashed edit-mode box with a floating toolbar — the shared chrome around
 * anything the dashboard editor lets you rearrange: view sections and bar
 * columns today, potentially more areas later.
 */
withDefaults(
  defineProps<{
    tag?: string
    editing?: boolean
    dragging?: boolean
    dropTarget?: boolean
  }>(),
  { tag: 'div' },
)
</script>

<template>
  <component
    :is="tag"
    class="vp-editable-area"
    :class="{
      editing,
      dragging,
      'drop-target': dropTarget,
    }"
  >
    <div v-if="editing && $slots.toolbar" class="vp-editable-area-toolbar">
      <slot name="toolbar" />
    </div>
    <slot />
  </component>
</template>
