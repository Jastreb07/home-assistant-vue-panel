<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEntity, useService } from '@/core/ha'
import MdiIcon from '@/core/ui/MdiIcon.vue'
import OverflowMarquee from '@/core/ui/OverflowMarquee.vue'

const props = defineProps<{
  config: { entity: string; name?: string; step?: number }
}>()

const { t } = useI18n()
const climate = useEntity(() => props.config.entity)
const { call } = useService('climate')

const displayName = computed(
  () =>
    props.config.name ??
    (climate.value?.attributes.friendly_name as string | undefined) ??
    props.config.entity,
)
const currentTemp = computed(
  () => climate.value?.attributes.current_temperature as number | undefined,
)
const targetTemp = computed(() => climate.value?.attributes.temperature as number | undefined)
const isHeating = computed(() => climate.value?.attributes.hvac_action === 'heating')
const isOff = computed(() => climate.value?.state === 'off')
const step = computed(() => props.config.step ?? 0.5)

function adjust(direction: 1 | -1) {
  if (!climate.value || targetTemp.value == null) return
  call(
    'set_temperature',
    { temperature: Math.round((targetTemp.value + direction * step.value) * 10) / 10 },
    { entity_id: props.config.entity },
  )
}
</script>

<template>
  <div class="thermostat-card" :class="{ active: isHeating }">
    <MdiIcon :icon="isHeating ? 'mdi:fire' : 'mdi:thermostat'" :size="30" />
    <div class="info">
      <OverflowMarquee class="name" :text="displayName" />
      <div class="state">
        <template v-if="!config.entity">{{ t('cards.common.noEntity') }}</template>
        <template v-else-if="!climate">{{ t('cards.common.notFound') }}</template>
        <template v-else>
          {{ currentTemp != null ? currentTemp + ' °' : '–' }}
          <span v-if="isOff" class="mode">· {{ t('cards.thermostat.off') }}</span>
          <span v-else-if="isHeating" class="mode">· {{ t('cards.thermostat.heating') }}</span>
        </template>
      </div>
    </div>
    <div v-if="climate && targetTemp != null" class="target" @click.stop>
      <button class="temp-btn" @click="adjust(-1)">
        <MdiIcon icon="mdi:minus" :size="18" />
      </button>
      <span class="target-value">{{ targetTemp }} °</span>
      <button class="temp-btn" @click="adjust(1)">
        <MdiIcon icon="mdi:plus" :size="18" />
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Tile */
.thermostat-card {
  background: var(--card-bg);
  border-radius: var(--card-radius);
  padding: 14px 16px;
  min-height: 120px;
  height: 100%;
  box-shadow: var(--card-shadow);
  color: var(--text-primary);
  transition: background 0.2s;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0;
}
.thermostat-card.active {
  background: #f6d36b;
  color: #111111;
}
.thermostat-card > .mdi {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: rgb(215 215 215 / 35%);
  color: #737373;
  display: flex;
  align-items: center;
  justify-content: center;
}
.thermostat-card.active > .mdi {
  background: rgba(255, 255, 255, 0.4);
  color: #111111;
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
.target {
  position: absolute;
  top: 11px;
  right: 14px;
  display: grid;
  grid-template-columns: repeat(2, 22px);
  align-items: center;
  justify-items: center;
  gap: 1px 2px;
}
.target-value {
  grid-column: 1 / -1;
  grid-row: 1;
  font-size: 11px;
  font-weight: 600;
  min-width: 44px;
  text-align: center;
}
.temp-btn {
  grid-row: 2;
  border: none;
  background: transparent;
  color: inherit;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.temp-btn:hover {
  background: rgb(215 215 215 / 35%);
}
</style>
