<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEntity, useService } from '@/core/ha'
import MdiIcon from '@/core/ui/MdiIcon.vue'

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
      <div class="name">{{ displayName }}</div>
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
  padding: 16px;
  min-height: 80px;
  height: 100%;
  box-shadow: var(--card-shadow);
  color: var(--text-primary);
  transition: background 0.2s;
  display: flex;
  align-items: center;
  gap: 14px;
}
.thermostat-card.active {
  background: var(--card-bg-active);
  color: var(--text-on-active);
}
.info {
  flex: 1;
  min-width: 0;
}
.name {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.state {
  font-size: 13px;
  opacity: 0.75;
  margin-top: 2px;
}
.target {
  display: flex;
  align-items: center;
  gap: 8px;
}
.target-value {
  font-size: 17px;
  font-weight: 600;
  min-width: 48px;
  text-align: center;
}
.temp-btn {
  border: 1px solid var(--divider);
  background: transparent;
  color: inherit;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.temp-btn:hover {
  border-color: var(--accent);
}
</style>
