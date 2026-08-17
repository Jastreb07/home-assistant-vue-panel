<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEntity } from '@/core/ha'
import MdiIcon from '@/core/ui/MdiIcon.vue'
import OverflowMarquee from '@/core/ui/OverflowMarquee.vue'

const props = defineProps<{
  config: { entity: string; name?: string; icon?: string }
}>()

const { t } = useI18n()
const entity = useEntity(() => props.config.entity)

const displayName = computed(
  () =>
    props.config.name ??
    (entity.value?.attributes.friendly_name as string | undefined) ??
    props.config.entity,
)
const icon = computed(
  () => props.config.icon || (entity.value?.attributes.icon as string | undefined) || 'mdi:gauge',
)
const unit = computed(
  () => (entity.value?.attributes.unit_of_measurement as string | undefined) ?? '',
)
</script>

<template>
  <div class="sensor-card">
    <MdiIcon :icon="icon" :size="30" />
    <div class="info">
      <OverflowMarquee class="name" :text="displayName" />
      <div class="value">
        <template v-if="!config.entity">{{ t('cards.common.noEntity') }}</template>
        <template v-else-if="!entity">{{ t('cards.common.notFound') }}</template>
        <template v-else>{{ entity.state }} {{ unit }}</template>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Tile */
.sensor-card {
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
.sensor-card > .mdi {
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
.name {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.2;
}
.value {
  margin-top: 3px;
  font-size: 11px;
  line-height: 1.2;
  color: #666666;
}
</style>
