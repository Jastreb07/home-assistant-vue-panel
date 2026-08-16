<script setup lang="ts">
import { themed } from '@/theme/registry'

/** Thin wrapper: renders the 'Card' component of the active theme. */
const Card = themed('Card')

defineProps<{
  /** Visually highlight the card (e.g. light on) */
  active?: boolean
  clickable?: boolean
}>()
</script>

<template>
  <component :is="Card" :active="active" :clickable="clickable">
    <slot />
  </component>
</template>
