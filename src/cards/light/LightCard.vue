<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEntity, useService } from '@/core/ha'
import MdiIcon from '@/core/ui/MdiIcon.vue'

const props = defineProps<{
  config: { entity: string; name?: string; showBrightness?: boolean }
}>()

const { t } = useI18n()
const light = useEntity(() => props.config.entity)
const { toggle } = useService('light')

const isOn = computed(() => light.value?.state === 'on')
const displayName = computed(
  () =>
    props.config.name ??
    (light.value?.attributes.friendly_name as string | undefined) ??
    props.config.entity,
)
const brightnessPct = computed(() => {
  const raw = light.value?.attributes.brightness as number | undefined
  return raw != null ? Math.round((raw / 255) * 100) : null
})

function onTap() {
  if (props.config.entity) toggle(props.config.entity)
}
</script>

<template>
  <div class="light-card" :class="{ active: isOn }" @click="onTap">
    <MdiIcon :icon="isOn ? 'mdi:lightbulb' : 'mdi:lightbulb-outline'" :size="32" />
    <div class="info">
      <div class="name">{{ displayName || t('cards.light.defaultName') }}</div>
      <div class="state">
        <template v-if="!config.entity">{{ t('cards.light.noEntity') }}</template>
        <template v-else-if="!light">{{ t('cards.light.notFound') }}</template>
        <template v-else>
          {{ isOn ? t('cards.light.on') : t('cards.light.off') }}
          <template v-if="isOn && config.showBrightness !== false && brightnessPct !== null">
            · {{ brightnessPct }} %
          </template>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Tile */
.light-card {
  background: var(--card-bg);
  border-radius: var(--card-radius);
  padding: 16px;
  min-height: 80px;
  height: 100%;
  box-shadow: var(--card-shadow);
  color: var(--text-primary);
  transition: background 0.2s, transform 0.1s;
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 14px;
}
.light-card:active {
  transform: scale(0.98);
}
.light-card.active {
  background: var(--card-bg-active);
  color: var(--text-on-active);
}
.name {
  font-weight: 600;
}
.state {
  font-size: 13px;
  opacity: 0.75;
  margin-top: 2px;
}
</style>
