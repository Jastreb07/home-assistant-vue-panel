<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useClock } from '@/core/composables/useClock'
import MdiIcon from '@/core/ui/MdiIcon.vue'

const props = defineProps<{
  config: { showTime?: boolean; showDate?: boolean }
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
const showTime = computed(() => props.config.showTime !== false)
const showDate = computed(() => props.config.showDate !== false)
</script>

<template>
  <div class="clock-card">
    <MdiIcon icon="mdi:clock-outline" :size="30" />
    <div class="info">
      <div v-if="showTime" class="time">{{ time }}</div>
      <div v-if="showDate" class="date">{{ date }}</div>
    </div>
  </div>
</template>

<style scoped>
/* Tile */
.clock-card {
  background: var(--card-bg);
  border-radius: var(--card-radius);
  padding: 14px 16px;
  min-height: 120px;
  height: 100%;
  box-shadow: var(--card-shadow);
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0;
}
.clock-card > .mdi {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: rgb(215 215 215 / 35%);
  color: #737373;
  display: flex;
  align-items: center;
  justify-content: center;
}
.info {
  width: 100%;
  margin-top: auto;
}
.time {
  font-size: 20px;
  font-weight: 500;
  line-height: 1;
}
.date {
  margin-top: 3px;
  font-size: 11px;
  line-height: 1.2;
  color: var(--text-secondary);
}
</style>
