<script setup lang="ts">
withDefaults(defineProps<{ variant?: 'default' | 'drag' }>(), { variant: 'default' })
</script>

<template>
  <button type="button" class="vp-editable-area-btn" :class="`vp-editable-area-btn--${variant}`">
    <slot />
  </button>
</template>
