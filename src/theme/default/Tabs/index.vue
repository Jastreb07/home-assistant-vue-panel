<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MdiIcon from '@/core/ui/MdiIcon.vue'
import type { TabItem } from '@/core/ui/tabs'

/** Underlined tab bar — switches the panel below it. */
const props = defineProps<{
  modelValue: string
  items: TabItem[]
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const activeIndex = computed(() => props.items.findIndex((i) => i.value === props.modelValue))
const shell = ref<HTMLElement | null>(null)
const tabList = ref<HTMLElement | null>(null)
const hasOverflow = ref(false)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)
let resizeObserver: ResizeObserver | undefined

function updateScrollEdges() {
  const element = tabList.value
  if (!element) return
  canScrollLeft.value = element.scrollLeft > 1
  canScrollRight.value = element.scrollLeft + element.clientWidth < element.scrollWidth - 1
}

function updateOverflow() {
  const container = shell.value
  const element = tabList.value
  if (!container || !element) return

  const overflow = element.scrollWidth > container.clientWidth + 1
  if (hasOverflow.value !== overflow) {
    hasOverflow.value = overflow
    void nextTick(updateScrollEdges)
    return
  }
  updateScrollEdges()
}

function scrollTabs(direction: -1 | 1) {
  const element = tabList.value
  if (!element) return
  element.scrollBy({
    left: direction * Math.max(160, element.clientWidth * 0.7),
    behavior: 'smooth',
  })
}

async function revealActiveTab() {
  await nextTick()
  tabList.value
    ?.querySelector<HTMLElement>('.vp-tab.active')
    ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  updateOverflow()
}

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

watch(() => props.modelValue, revealActiveTab)
watch(() => props.items, () => void nextTick(updateOverflow), { deep: true })

onMounted(() => {
  resizeObserver = new ResizeObserver(updateOverflow)
  if (shell.value) resizeObserver.observe(shell.value)
  if (tabList.value) resizeObserver.observe(tabList.value)
  updateOverflow()
})

onBeforeUnmount(() => resizeObserver?.disconnect())
</script>

<template>
  <div ref="shell" class="vp-tabs-shell">
    <button
      v-if="hasOverflow"
      type="button"
      class="vp-tabs-scroll vp-tabs-scroll--left"
      :disabled="!canScrollLeft"
      :title="$t('common.tabs.scrollLeft')"
      :aria-label="$t('common.tabs.scrollLeft')"
      @click="scrollTabs(-1)"
    >
      <MdiIcon icon="mdi:chevron-left" :size="22" />
    </button>

    <div ref="tabList" class="vp-tabs" role="tablist" @keydown="onKeydown" @scroll="updateScrollEdges">
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

    <button
      v-if="hasOverflow"
      type="button"
      class="vp-tabs-scroll vp-tabs-scroll--right"
      :disabled="!canScrollRight"
      :title="$t('common.tabs.scrollRight')"
      :aria-label="$t('common.tabs.scrollRight')"
      @click="scrollTabs(1)"
    >
      <MdiIcon icon="mdi:chevron-right" :size="22" />
    </button>
  </div>
</template>
