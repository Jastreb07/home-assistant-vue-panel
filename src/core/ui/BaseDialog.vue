<script setup lang="ts">
import { themed } from '@/theme/registry'

/** Thin wrapper: renders the 'Dialog' component of the active theme. */
const Dialog = themed('Dialog')

defineProps<{
  title: string
  /** Dialog width: md (default), lg, xl, full */
  size?: 'md' | 'lg' | 'xl' | 'full'
}>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <component :is="Dialog" :title="title" :size="size" @close="emit('close')">
    <slot />
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </component>
</template>
