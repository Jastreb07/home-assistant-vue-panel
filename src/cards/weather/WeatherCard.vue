<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEntity } from '@/core/ha'
import MdiIcon from '@/core/ui/MdiIcon.vue'
import OverflowMarquee from '@/core/ui/OverflowMarquee.vue'

const props = defineProps<{
  config: {
    entity: string
    name?: string
    showDetails?: boolean
    roundTemperature?: boolean
    animation?: boolean
  }
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
const temperature = computed(() => {
  const value = weather.value?.attributes.temperature as number | undefined
  if (value == null) return undefined
  return props.config.roundTemperature !== false ? Math.round(value) : value
})
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

/**
 * `animated` switches the background animation on, `cond-<state>` selects
 * which one. The rules live in the manifest's default CSS, so they show
 * up in the card's CSS editor and can be reworked there.
 */
const stateClasses = computed(() => [
  { animated: props.config.animation === true },
  `cond-${condition.value || 'unknown'}`,
])
</script>

<template>
  <div class="weather-card" :class="stateClasses">
    <MdiIcon :icon="icon" :size="42" />
    <div class="info">
      <OverflowMarquee class="name" :text="displayName" />
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
</template>

<style scoped>
/* Tile */
.weather-card {
  background: var(--card-bg);
  border-radius: var(--card-radius);
  padding: 14px 16px;
  min-height: 120px;
  height: 100%;
  box-shadow: var(--card-shadow);
  color: var(--text-primary);
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0;
}
.weather-card > .mdi {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: rgb(215 215 215 / 35%);
  color: #737373;
  display: flex;
  align-items: center;
  justify-content: center;
}
.weather-card.animated > .mdi {
  background: rgba(255, 255, 255, 0.25);
  color: inherit;
}
.info {
  width: 100%;
  margin-top: auto;
  min-width: 0;
}
.name {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.state {
  margin-top: 3px;
  font-size: 11px;
  line-height: 1.2;
  color: #666666;
}
.numbers {
  position: absolute;
  top: 13px;
  right: 14px;
  max-width: 58px;
  text-align: right;
}
.temp {
  font-size: 15px;
  font-weight: 600;
}
.details {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-top: 2px;
  font-size: 8px;
  color: #666666;
  justify-content: flex-end;
}
.details span {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.weather-card.animated .state,
.weather-card.animated .details {
  color: inherit;
}
</style>
