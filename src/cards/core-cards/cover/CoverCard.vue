<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEntity, useService } from '@/core/ha'
import MdiIcon from '@/core/ui/MdiIcon.vue'
import OverflowMarquee from '@/core/ui/OverflowMarquee.vue'

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
        <OverflowMarquee class="name" :text="displayName" />
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
  padding: 14px 16px;
  min-height: 120px;
  height: 100%;
  box-shadow: var(--card-shadow);
  color: var(--text-primary);
  transition: background 0.2s;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0;
}
.cover-card.active {
  background: #f6d36b;
  color: #111111;
}
.top {
  width: 100%;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0;
}
.top > .mdi {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: rgb(215 215 215 / 35%);
  color: #737373;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cover-card.active .top > .mdi {
  background: rgba(255, 255, 255, 0.4);
  color: #111111;
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
.state {
  margin-top: 3px;
  font-size: 11px;
  line-height: 1.2;
  color: #666666;
}
.controls {
  position: absolute;
  top: 16px;
  right: 12px;
  display: flex;
  gap: 2px;
}
.ctl-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: inherit;
  border-radius: 50%;
  padding: 0;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.ctl-btn:hover {
  background: rgb(215 215 215 / 35%);
}
</style>
