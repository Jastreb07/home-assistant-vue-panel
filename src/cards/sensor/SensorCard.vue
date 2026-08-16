<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEntity } from '@/core/ha'
import BaseCard from '@/core/ui/BaseCard.vue'
import MdiIcon from '@/core/ui/MdiIcon.vue'

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
  <BaseCard>
    <div class="sensor-card">
      <MdiIcon :icon="icon" :size="30" />
      <div class="info">
        <div class="name">{{ displayName }}</div>
        <div class="value">
          <template v-if="!config.entity">{{ t('cards.common.noEntity') }}</template>
          <template v-else-if="!entity">{{ t('cards.common.notFound') }}</template>
          <template v-else>{{ entity.state }} {{ unit }}</template>
        </div>
      </div>
    </div>
  </BaseCard>
</template>

<style scoped>
.sensor-card {
  display: flex;
  align-items: center;
  gap: 14px;
  height: 100%;
}
.name {
  font-size: 13px;
  opacity: 0.75;
}
.value {
  font-size: 20px;
  font-weight: 600;
  margin-top: 2px;
}
</style>
