<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEntity, useService } from '@/core/ha'
import MdiIcon from '@/core/ui/MdiIcon.vue'
import OverflowMarquee from '@/core/ui/OverflowMarquee.vue'

const props = defineProps<{
  config: { entity: string; name?: string; icon?: string; showBrightness?: boolean }
}>()

const { t } = useI18n()
const light = useEntity(() => props.config.entity)
const { toggle } = useService('light')

const isOn = computed(() => light.value?.state === 'on')
const icon = computed(
  () => props.config.icon || (isOn.value ? 'mdi:lightbulb' : 'mdi:lightbulb-outline'),
)
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
    <MdiIcon :icon="icon" :size="32" />
    <div class="info">
      <OverflowMarquee class="name" :text="displayName || t('cards.light.defaultName')" />
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
  padding: 14px 16px;
  min-height: 120px;
  height: 100%;
  box-shadow: var(--card-shadow);
  color: var(--text-primary);
  cursor: pointer;
  user-select: none;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0;
  transition: background 0.2s, transform 0.1s;
}
.light-card > .mdi {
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
.light-card:active {
  transform: scale(0.98);
}
.light-card.active {
  background: #f6d36b;
  color: #111111;
}
.light-card.active > .mdi {
  background: rgba(255, 255, 255, 0.4);
  color: #111111;
}
.name {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.2;
}
.state {
  margin-top: 3px;
  font-size: 11px;
  line-height: 1.2;
  color: #666666;
  opacity: 1;
}
</style>
