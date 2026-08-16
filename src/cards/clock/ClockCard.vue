<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useClock } from '@/core/composables/useClock'

const props = defineProps<{
  config: { showDate?: boolean }
}>()

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
const showDate = computed(() => props.config.showDate !== false)
</script>

<template>
  <div class="clock-card">
    <div class="time">{{ time }}</div>
    <div v-if="showDate" class="date">{{ date }}</div>
  </div>
</template>

<style scoped>
/* Tile */
.clock-card {
  background: var(--card-bg);
  border-radius: var(--card-radius);
  padding: 16px;
  min-height: 80px;
  height: 100%;
  box-shadow: var(--card-shadow);
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.time {
  font-size: 40px;
  font-weight: 200;
  line-height: 1;
}
.date {
  margin-top: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}
</style>
