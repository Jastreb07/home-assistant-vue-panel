<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useClock } from '@/core/composables/useClock'

/**
 * Fullscreen screensaver overlay: dark background with a large clock.
 * Any interaction is caught by the global idle listeners, which resets
 * the idle time — the parent then hides this overlay.
 */
const { locale } = useI18n()
const now = useClock()

const time = computed(() =>
  now.value.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' }),
)
const date = computed(() =>
  now.value.toLocaleDateString(locale.value, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }),
)
</script>

<template>
  <div class="screensaver">
    <div class="time">{{ time }}</div>
    <div class="date">{{ date }}</div>
  </div>
</template>

<style scoped>
.screensaver {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: #000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  cursor: none;
  animation: fade-in 1.2s ease;
}
@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
.time {
  font-size: clamp(64px, 14vw, 180px);
  font-weight: 200;
  color: rgba(255, 255, 255, 0.85);
  letter-spacing: 0.02em;
}
.date {
  font-size: clamp(16px, 3vw, 32px);
  color: rgba(255, 255, 255, 0.45);
}
</style>
