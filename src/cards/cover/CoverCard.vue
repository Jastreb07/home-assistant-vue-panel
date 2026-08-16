<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEntity, useService } from '@/core/ha'
import BaseCard from '@/core/ui/BaseCard.vue'
import MdiIcon from '@/core/ui/MdiIcon.vue'

const props = defineProps<{
  config: { entity: string; name?: string }
}>()

const { t } = useI18n()
const cover = useEntity(() => props.config.entity)
const { call } = useService('cover')

const displayName = computed(
  () =>
    props.config.name ??
    (cover.value?.attributes.friendly_name as string | undefined) ??
    props.config.entity,
)
const position = computed(
  () => cover.value?.attributes.current_position as number | undefined,
)
const isOpen = computed(() => cover.value?.state === 'open')
const stateText = computed(() => {
  const s = cover.value?.state
  if (s === 'open') return t('cards.cover.open')
  if (s === 'closed') return t('cards.cover.closed')
  if (s === 'opening') return t('cards.cover.opening')
  if (s === 'closing') return t('cards.cover.closing')
  return s ?? ''
})

function service(name: 'open_cover' | 'close_cover' | 'stop_cover') {
  call(name, undefined, { entity_id: props.config.entity })
}
</script>

<template>
  <BaseCard :active="isOpen">
    <div class="cover-card">
      <div class="top">
        <MdiIcon :icon="isOpen ? 'mdi:window-shutter-open' : 'mdi:window-shutter'" :size="28" />
        <div class="info">
          <div class="name">{{ displayName }}</div>
          <div class="state">
            <template v-if="!config.entity">{{ t('cards.common.noEntity') }}</template>
            <template v-else-if="!cover">{{ t('cards.common.notFound') }}</template>
            <template v-else>
              {{ stateText }}
              <template v-if="position != null"> · {{ position }} %</template>
            </template>
          </div>
        </div>
      </div>
      <div v-if="cover" class="controls" @click.stop>
        <button class="ctl-btn" :title="t('cards.cover.openAction')" @click="service('open_cover')">
          <MdiIcon icon="mdi:arrow-up" :size="20" />
        </button>
        <button class="ctl-btn" :title="t('cards.cover.stopAction')" @click="service('stop_cover')">
          <MdiIcon icon="mdi:stop" :size="20" />
        </button>
        <button class="ctl-btn" :title="t('cards.cover.closeAction')" @click="service('close_cover')">
          <MdiIcon icon="mdi:arrow-down" :size="20" />
        </button>
      </div>
    </div>
  </BaseCard>
</template>

<style scoped>
.cover-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}
.top {
  display: flex;
  align-items: center;
  gap: 12px;
}
.name {
  font-weight: 600;
}
.state {
  font-size: 13px;
  opacity: 0.75;
  margin-top: 2px;
}
.controls {
  display: flex;
  gap: 8px;
}
.ctl-btn {
  flex: 1;
  border: 1px solid var(--divider);
  background: transparent;
  color: inherit;
  border-radius: 8px;
  padding: 6px 0;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.ctl-btn:hover {
  border-color: var(--accent);
}
</style>
