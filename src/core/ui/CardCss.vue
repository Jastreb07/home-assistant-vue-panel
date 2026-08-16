<script setup lang="ts">
import { onUnmounted, watchEffect } from 'vue'

/**
 * Renderless helper that applies per-card custom CSS.
 * Injects a <style> element into <head> whose rules are scoped to the
 * card instance via native CSS nesting:
 *   [data-vp-card="<id>"] { ...user css... }
 * The rendering wrapper must carry the matching `data-vp-card` attribute.
 */
const props = defineProps<{
  cardId: string
  css: string
}>()

const el = document.createElement('style')
el.setAttribute('data-vp-card-css', props.cardId)
document.head.appendChild(el)

watchEffect(() => {
  el.textContent = props.css.trim()
    ? `[data-vp-card="${CSS.escape(props.cardId)}"] {\n${props.css}\n}`
    : ''
})

onUnmounted(() => el.remove())
</script>

<template>
  <slot />
</template>
