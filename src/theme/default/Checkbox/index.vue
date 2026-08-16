<script setup lang="ts">
import MdiIcon from '@/core/ui/MdiIcon.vue'

/**
 * Checkbox with a styled box instead of the native control. The real
 * <input> stays in the DOM (visually hidden) so keyboard, focus and
 * form semantics keep working.
 */
defineProps<{
  modelValue: boolean
  disabled?: boolean
  /** Optional text next to the box */
  label?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <label class="vp-checkbox" :class="{ disabled }">
    <input
      class="vp-checkbox-input"
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span class="vp-checkbox-box" :class="{ checked: modelValue }">
      <MdiIcon v-if="modelValue" icon="mdi:check" :size="16" />
    </span>
    <span v-if="label" class="vp-checkbox-label">{{ label }}</span>
  </label>
</template>
