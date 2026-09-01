<script setup lang="ts">
import { themed } from '@/theme/registry'

/** Thin wrapper: renders the 'Dialog' component of the active theme. */
const Dialog = themed('Dialog')

defineProps<{
  title: string
  /** Dialog width: md (default), lg, xl, full */
  size?: 'md' | 'lg' | 'xl' | 'full'
  /** Optional icon in front of the title */
  icon?: string
  /** Optional HA-style context label above the title */
  subtitle?: string
  /** Explicit dialog width in px — beats the size preset */
  width?: number
  /** Explicit body height in px — the content decides when unset */
  bodyHeight?: number
}>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <component
    :is="Dialog"
    :title="title"
    :size="size"
    :icon="icon"
    :subtitle="subtitle"
    :width="width"
    :body-height="bodyHeight"
    @close="emit('close')"
  >
    <template v-if="$slots.background" #background>
      <slot name="background" />
    </template>
    <slot />
    <template v-if="$slots.actions" #actions>
      <slot name="actions" />
    </template>
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </component>
</template>
