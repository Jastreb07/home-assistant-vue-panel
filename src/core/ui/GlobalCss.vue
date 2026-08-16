<script setup lang="ts">
import { onUnmounted, watchEffect } from 'vue'
import { useDashboardStore } from '@/core/config/dashboardStore'

/**
 * Renderless helper that applies the dashboard's global CSS override
 * (settings.customCss) on top of the theme's main.css. Mounted once in
 * App.vue; the <style> element is appended last so it wins on ties.
 */
const store = useDashboardStore()

const el = document.createElement('style')
el.setAttribute('data-vp-global-css', '')
document.head.appendChild(el)

watchEffect(() => {
  const css = store.settings.customCss ?? ''
  el.textContent = css.trim()
  // Keep it last in <head> — lazy theme chunks append after us otherwise
  if (el.textContent && document.head.lastElementChild !== el) document.head.appendChild(el)
})

onUnmounted(() => el.remove())
</script>

<template>
  <slot />
</template>
