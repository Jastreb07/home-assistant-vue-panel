<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  /** mdi icon in HA format, e.g. 'mdi:lightbulb' */
  icon: string
  size?: number
}>()

const cssClass = computed(() => `mdi mdi-${props.icon.replace(/^mdi:/, '')}`)
</script>

<template>
  <span :class="cssClass" :style="{ fontSize: (size ?? 24) + 'px' }" />
</template>
