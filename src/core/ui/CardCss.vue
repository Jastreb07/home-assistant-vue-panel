<script setup lang="ts">
import { computed, onUnmounted, provide, watchEffect } from 'vue'
import { cardCssContextKey } from './cardCssContext'

/**
 * Renderless helper that applies per-card custom CSS.
 * Injects a <style> element into <head> whose rules are scoped to the
 * card instance via native CSS nesting:
 *   [data-vp-card="<id>"][data-vp-card="<id>"] { ...user css... }
 * The rendering wrapper must carry the matching `data-vp-card` attribute.
 *
 * The attribute is repeated on purpose: card components are lazy, so
 * their scoped CSS chunk can reach <head> AFTER this element. With a
 * single attribute both rules tie at (0,2,0) and document order decides
 * — which is why a hard reload used to fall back to the card's own CSS.
 * Doubling it wins on specificity regardless of load order.
 */
const props = defineProps<{
  cardId: string
  /** Full CSS applied to the card, including the generated visibility rules. */
  css: string
  /** The user's own CSS only, without visibility rules — passed to nested
   *  portable cards. Defaults to `css` when not given. */
  contentCss?: string
}>()

provide(cardCssContextKey, computed(() => props.contentCss ?? props.css))

const el = document.createElement('style')
el.setAttribute('data-vp-card-css', props.cardId)
document.head.appendChild(el)

watchEffect(() => {
  const attr = `[data-vp-card="${CSS.escape(props.cardId)}"]`
  el.textContent = props.css.trim() ? `${attr}${attr} {\n${props.css}\n}` : ''
})

onUnmounted(() => el.remove())
</script>

<template>
  <slot />
</template>
