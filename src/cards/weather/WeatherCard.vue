<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEntity } from '@/core/ha'
import BaseCard from '@/core/ui/BaseCard.vue'
import MdiIcon from '@/core/ui/MdiIcon.vue'

const props = defineProps<{
  config: { entity: string; name?: string; showDetails?: boolean }
}>()

const { t } = useI18n()
const weather = useEntity(() => props.config.entity)

// HA weather conditions → mdi icons
const conditionIcons: Record<string, string> = {
  'clear-night': 'mdi:weather-night',
  cloudy: 'mdi:weather-cloudy',
  fog: 'mdi:weather-fog',
  hail: 'mdi:weather-hail',
  lightning: 'mdi:weather-lightning',
  'lightning-rainy': 'mdi:weather-lightning-rainy',
  partlycloudy: 'mdi:weather-partly-cloudy',
  pouring: 'mdi:weather-pouring',
  rainy: 'mdi:weather-rainy',
  snowy: 'mdi:weather-snowy',
  'snowy-rainy': 'mdi:weather-snowy-rainy',
  sunny: 'mdi:weather-sunny',
  windy: 'mdi:weather-windy',
  'windy-variant': 'mdi:weather-windy-variant',
  exceptional: 'mdi:alert-circle-outline',
}

const displayName = computed(
  () =>
    props.config.name ??
    (weather.value?.attributes.friendly_name as string | undefined) ??
    props.config.entity,
)
const condition = computed(() => weather.value?.state ?? '')
const icon = computed(() => conditionIcons[condition.value] ?? 'mdi:weather-partly-cloudy')
const temperature = computed(() => weather.value?.attributes.temperature as number | undefined)
const tempUnit = computed(
  () => (weather.value?.attributes.temperature_unit as string | undefined) ?? '°C',
)
const humidity = computed(() => weather.value?.attributes.humidity as number | undefined)
const windSpeed = computed(() => weather.value?.attributes.wind_speed as number | undefined)
const windUnit = computed(
  () => (weather.value?.attributes.wind_speed_unit as string | undefined) ?? 'km/h',
)

const conditionText = computed(() =>
  condition.value ? t('cards.weather.conditions.' + condition.value, condition.value) : '',
)
</script>

<template>
  <BaseCard>
    <div class="weather-card">
      <MdiIcon :icon="icon" :size="42" />
      <div class="info">
        <div class="name">{{ displayName }}</div>
        <div class="state">
          <template v-if="!config.entity">{{ t('cards.common.noEntity') }}</template>
          <template v-else-if="!weather">{{ t('cards.common.notFound') }}</template>
          <template v-else>{{ conditionText }}</template>
        </div>
      </div>
      <div v-if="weather" class="numbers">
        <div class="temp">{{ temperature != null ? temperature + ' ' + tempUnit : '–' }}</div>
        <div v-if="config.showDetails !== false" class="details">
          <span v-if="humidity != null">
            <MdiIcon icon="mdi:water-percent" :size="14" /> {{ humidity }} %
          </span>
          <span v-if="windSpeed != null">
            <MdiIcon icon="mdi:weather-windy" :size="14" /> {{ Math.round(windSpeed) }} {{ windUnit }}
          </span>
        </div>
      </div>
    </div>
  </BaseCard>
</template>

<style scoped>
.weather-card {
  display: flex;
  align-items: center;
  gap: 14px;
  height: 100%;
}
.info {
  flex: 1;
  min-width: 0;
}
.name {
  font-weight: 600;
}
.state {
  font-size: 13px;
  opacity: 0.75;
  margin-top: 2px;
}
.numbers {
  text-align: right;
}
.temp {
  font-size: 22px;
  font-weight: 600;
}
.details {
  display: flex;
  gap: 10px;
  font-size: 12px;
  opacity: 0.75;
  margin-top: 4px;
  justify-content: flex-end;
}
.details span {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
</style>
