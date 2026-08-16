<script setup lang="ts">
defineProps<{
  variant?: 'default' | 'primary' | 'danger'
  disabled?: boolean
}>()
</script>

<template>
  <button class="vp-btn" :class="variant" :disabled="disabled">
    <slot />
  </button>
</template>
