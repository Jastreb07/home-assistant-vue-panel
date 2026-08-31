<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  createHassCard,
  destroyHassCard,
  hassCardsAvailable,
  measureOverlay,
  onOverlayRecheck,
  placeHassCard,
  updateHassCard,
} from './hassCardBridge'
import { hassCardConfig } from '@/core/registry/hassCards'
import { newId, useDashboardStore } from '@/core/config/dashboardStore'
import MdiIcon from '@/core/ui/MdiIcon.vue'

/**
 * Placeholder for a native Home Assistant card. The real card is created by
 * the loader in the Home Assistant document and laid over this element — see
 * hassCardBridge.ts. All this component does is reserve the space and keep
 * the overlay in sync with its own position on screen.
 */
const props = defineProps<{
  config: Record<string, unknown>
  /** The card config dialog previews cards while edit mode is on */
  preview?: boolean
}>()

const store = useDashboardStore()
const host = ref<HTMLElement | null>(null)
/** Overlay id — unique per mounted instance, not per stored card */
const overlayId = newId('hasscard')

/**
 * The real card is painted by Home Assistant ABOVE this iframe, so it would
 * also cover the engine's own edit overlay. While editing, the overlay card
 * steps aside and a plain stand-in marks the spot, which keeps the card
 * selectable, draggable and configurable like every other card.
 */
const parked = computed(() => store.editMode && !props.preview)
const cardType = computed(() => String(hassCardConfig(props.config).type ?? ''))

function publishRect() {
  const element = host.value
  if (!element) return
  placeHassCard(overlayId, measureOverlay(element, parked.value))
}

let frame = 0

/** Position updates are frequent (scroll, resize) — one per animation frame. */
function schedulePublish() {
  if (frame) return
  frame = requestAnimationFrame(() => {
    frame = 0
    publishRect()
  })
}

let observer: ResizeObserver | null = null
let stopRecheck: (() => void) | null = null

onMounted(() => {
  if (!hassCardsAvailable) return
  createHassCard(overlayId, hassCardConfig(props.config))
  publishRect()
  observer = new ResizeObserver(schedulePublish)
  if (host.value) observer.observe(host.value)
  // Any ancestor may scroll, so listen in the capture phase
  window.addEventListener('scroll', schedulePublish, true)
  window.addEventListener('resize', schedulePublish)
  // Dialogs and popups appear without a scroll or resize event of their own
  stopRecheck = onOverlayRecheck(schedulePublish)
})

onBeforeUnmount(() => {
  if (!hassCardsAvailable) return
  if (frame) cancelAnimationFrame(frame)
  observer?.disconnect()
  stopRecheck?.()
  window.removeEventListener('scroll', schedulePublish, true)
  window.removeEventListener('resize', schedulePublish)
  destroyHassCard(overlayId)
})

watch(
  () => props.config,
  (value) => {
    if (hassCardsAvailable) updateHassCard(overlayId, hassCardConfig(value))
  },
  { deep: true },
)

// Entering or leaving edit mode parks the overlay card / brings it back
watch(parked, schedulePublish)
</script>

<template>
  <div ref="host" class="hass-card-host">
    <p v-if="!hassCardsAvailable" class="hass-card-note">
      {{ $t('editor.hassCards.unavailable') }}
    </p>
    <div v-else-if="parked" class="hass-card-stand-in">
      <MdiIcon icon="mdi:home-assistant" :size="26" />
      <span>{{ cardType || $t('editor.hassCards.cardName') }}</span>
    </div>
  </div>
</template>

<style scoped>
.hass-card-host {
  /* The real card is painted above this box by the Home Assistant document */
  width: 100%;
  min-height: 60px;
  height: 100%;
}
.hass-card-note {
  margin: 0;
  padding: 16px;
  border: 2px dashed var(--divider);
  border-radius: var(--card-radius);
  color: var(--text-secondary);
  font-size: 12px;
}
/* Marks the card's place while editing, in place of the parked overlay */
.hass-card-stand-in {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 100%;
  min-height: 60px;
  padding: 14px;
  border-radius: var(--card-radius);
  background: var(--card-bg);
  box-shadow: var(--card-shadow);
  color: var(--text-secondary);
  font-size: 12px;
  text-align: center;
  overflow: hidden;
}
.hass-card-stand-in span {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
