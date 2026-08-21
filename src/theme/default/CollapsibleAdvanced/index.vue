<script setup lang="ts">
import { ref } from 'vue'
import MdiIcon from '@/core/ui/MdiIcon.vue'

const props = withDefaults(defineProps<{
  title: string
  /** Readable name shown in brackets behind the technical title */
  subtitle?: string
  marker?: string | number
  defaultOpen?: boolean
  removeLabel: string
}>(), { defaultOpen: false })

const emit = defineEmits<{ remove: [] }>()
const open = ref(props.defaultOpen)
</script>

<template>
  <section class="vp-variable-card" :class="{ open }">
    <header class="vp-variable-card-head">
      <button
        type="button"
        class="vp-variable-card-toggle"
        :aria-expanded="open"
        @click="open = !open"
      >
        <MdiIcon icon="mdi:chevron-right" class="vp-variable-card-chevron" :size="18" />
        <span v-if="marker !== undefined" class="vp-variable-card-marker">{{ marker }}</span>
        <code class="vp-variable-card-title">{{ title }}</code>
        <span v-if="subtitle" class="vp-variable-card-subtitle">({{ subtitle }})</span>
      </button>
      <button
        type="button"
        class="vp-variable-card-remove"
        :aria-label="removeLabel"
        :title="removeLabel"
        @click="emit('remove')"
      >
        <MdiIcon icon="mdi:delete-outline" :size="17" />
      </button>
    </header>
    <div v-show="open" class="vp-variable-card-body">
      <slot />
    </div>
  </section>
</template>
