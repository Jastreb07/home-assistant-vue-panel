<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{ text?: string | null }>()
const labelText = computed(() => props.text ?? '')

const root = ref<HTMLElement>()
const content = ref<HTMLElement>()
const overflowing = ref(false)
const duration = ref('6s')
let observer: ResizeObserver | undefined

function measure() {
  const viewport = root.value
  const label = content.value
  if (!viewport || !label) return
  overflowing.value = label.scrollWidth > viewport.clientWidth + 1
  duration.value = `${Math.max(6, (label.scrollWidth + 24) / 24)}s`
}

watch(labelText, () => nextTick(measure))

onMounted(() => {
  observer = new ResizeObserver(measure)
  if (root.value) observer.observe(root.value)
  if (content.value) observer.observe(content.value)
  nextTick(measure)
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div
    ref="root"
    class="vp-overflow-marquee"
    :class="{ 'is-overflowing': overflowing }"
    :title="overflowing ? labelText : undefined"
  >
    <span class="vp-overflow-marquee-track" :style="{ '--vp-marquee-duration': duration }">
      <span ref="content" class="vp-overflow-marquee-text">{{ labelText }}</span>
      <span v-if="overflowing" class="vp-overflow-marquee-text" aria-hidden="true">{{ labelText }}</span>
    </span>
  </div>
</template>

<style scoped>
.vp-overflow-marquee {
  width: 100%;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}

.vp-overflow-marquee-track {
  display: inline-flex;
  min-width: max-content;
  gap: 24px;
}

.vp-overflow-marquee.is-overflowing .vp-overflow-marquee-track {
  animation: vp-overflow-marquee var(--vp-marquee-duration) linear infinite;
}

@keyframes vp-overflow-marquee {
  to {
    transform: translateX(calc(-50% - 12px));
  }
}

@media (prefers-reduced-motion: reduce) {
  .vp-overflow-marquee-track {
    display: block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    animation: none !important;
  }

  .vp-overflow-marquee-text[aria-hidden='true'] {
    display: none;
  }
}
</style>
