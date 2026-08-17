<script setup lang="ts">
import { computed } from 'vue'
import MdiIcon from '@/core/ui/MdiIcon.vue'
import type { TabItem } from '@/core/ui/tabs'

/** Underlined tab bar — switches the panel below it. */
const props = defineProps<{
  modelValue: string
  items: TabItem[]
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const activeIndex = computed(() => props.items.findIndex((i) => i.value === props.modelValue))

/** ←/→ move between tabs, as expected from a tablist. */
function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  e.preventDefault()
  const count = props.items.length
  if (count === 0) return
  const step = e.key === 'ArrowRight' ? 1 : -1
  const next = (Math.max(0, activeIndex.value) + step + count) % count
  emit('update:modelValue', props.items[next]!.value)
}
</script>

<template>
  <div class="vp-tabs" role="tablist" @keydown="onKeydown">
    <button
      v-for="item in items"
      :key="item.value"
      type="button"
      role="tab"
      class="vp-tab"
      :class="{ active: item.value === modelValue, 'vp-tab--end': item.align === 'end' }"
      :aria-selected="item.value === modelValue"
      :tabindex="item.value === modelValue ? 0 : -1"
      @click="emit('update:modelValue', item.value)"
    >
      <MdiIcon v-if="item.icon" :icon="item.icon" :size="16" />
      <span>{{ item.label }}</span>
    </button>
  </div>
</template>
