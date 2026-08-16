<script setup lang="ts">
defineProps<{
  /** Visually highlight the card (e.g. light on) */
  active?: boolean
  clickable?: boolean
}>()
</script>

<template>
  <div class="vp-card" :class="{ active, clickable }">
    <slot />
  </div>
</template>
