<script setup lang="ts">
import { ref } from 'vue'
import MdiIcon from '@/core/ui/MdiIcon.vue'

/** Collapsible box — groups related settings under a clickable header. */
const props = withDefaults(
  defineProps<{
    title: string
    /** Optional mdi icon in front of the title */
    icon?: string
    /** Start expanded — collapsed by default, so only the lead box is open */
    defaultOpen?: boolean
  }>(),
  { defaultOpen: false },
)

const open = ref(props.defaultOpen)
</script>

<template>
  <section class="vp-collapsible" :class="{ open }">
    <button
      type="button"
      class="vp-collapsible-head"
      :aria-expanded="open"
      @click="open = !open"
    >
      <MdiIcon icon="mdi:chevron-right" class="vp-collapsible-chevron" :size="18" />
      <MdiIcon v-if="icon" :icon="icon" :size="16" />
      <span class="vp-collapsible-title">{{ title }}</span>
    </button>
    <div v-show="open" class="vp-collapsible-body">
      <slot />
    </div>
  </section>
</template>
