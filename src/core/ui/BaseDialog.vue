<script setup lang="ts">
import { themed } from '@/theme/registry'

/** Thin wrapper: renders the 'Dialog' component of the active theme. */
const Dialog = themed('Dialog')

defineProps<{
  title: string
  wide?: boolean
}>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <component :is="Dialog" :title="title" :wide="wide" @close="emit('close')">
    <slot />
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </component>
</template>
