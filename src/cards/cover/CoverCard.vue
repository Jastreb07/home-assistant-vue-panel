<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEntity, useService } from '@/core/ha'
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
  <div class="cover-card" :class="{ active: isOpen }">
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
</template>

<style scoped>
/* Tile */
.cover-card {
  background: var(--card-bg);
  border-radius: var(--card-radius);
  padding: 16px;
  min-height: 80px;
  height: 100%;
  box-shadow: var(--card-shadow);
  color: var(--text-primary);
  transition: background 0.2s;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.cover-card.active {
  background: var(--card-bg-active);
  color: var(--text-on-active);
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
