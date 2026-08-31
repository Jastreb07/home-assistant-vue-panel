<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  createHassEditor,
  destroyHassCard,
  hassCardsAvailable,
  measureOverlay,
  onOverlayRecheck,
  placeHassCard,
  watchHassEditor,
} from './hassCardBridge'
import { newId } from '@/core/config/dashboardStore'

/**
 * Home Assistant's own settings form for a Lovelace card, laid over this
 * placeholder by the loader (see hassCardBridge.ts). Cards that ship no
 * visual editor report back as unavailable, so the dialog can fall back to
 * its JSON editor.
 */
const props = defineProps<{
  config: Record<string, unknown>
}>()
const emit = defineEmits<{
  'update:config': [config: Record<string, unknown>]
  /** False once Home Assistant reports the card has no visual editor */
  available: [available: boolean]
}>()

const host = ref<HTMLElement | null>(null)
const overlayId = newId('hasseditor')
let stopWatching: (() => void) | null = null

function publishRect() {
  const element = host.value
  if (!element) return
  placeHassCard(overlayId, measureOverlay(element))
}

let frame = 0

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
  if (!hassCardsAvailable) {
    emit('available', false)
    return
  }
  stopWatching = watchHassEditor(overlayId, {
    onConfig: (config) => emit('update:config', config),
    onReady: (available) => emit('available', available),
  })
  createHassEditor(overlayId, props.config)
  publishRect()
  observer = new ResizeObserver(schedulePublish)
  if (host.value) observer.observe(host.value)
  window.addEventListener('scroll', schedulePublish, true)
  window.addEventListener('resize', schedulePublish)
  stopRecheck = onOverlayRecheck(schedulePublish)
})

onBeforeUnmount(() => {
  if (frame) cancelAnimationFrame(frame)
  observer?.disconnect()
  stopRecheck?.()
  window.removeEventListener('scroll', schedulePublish, true)
  window.removeEventListener('resize', schedulePublish)
  stopWatching?.()
  if (hassCardsAvailable) destroyHassCard(overlayId)
})
</script>

<template>
  <div ref="host" class="hass-editor-host" />
</template>

<style scoped>
.hass-editor-host {
  /* The real editor is painted above this box by Home Assistant. Its forms
     are tall, so the placeholder claims a generous share of the dialog and
     the overlay scrolls internally beyond that. */
  flex: 1;
  min-height: min(560px, 62dvh);
}
</style>
