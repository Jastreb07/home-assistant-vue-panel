<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEntity, useService } from '@/core/ha'
import BaseCard from '@/core/ui/BaseCard.vue'
import MdiIcon from '@/core/ui/MdiIcon.vue'

const props = defineProps<{
  config: { entity: string; name?: string; showVolume?: boolean }
}>()

const { t } = useI18n()
const player = useEntity(() => props.config.entity)
const { call } = useService('media_player')

const displayName = computed(
  () =>
    props.config.name ??
    (player.value?.attributes.friendly_name as string | undefined) ??
    props.config.entity,
)
const isPlaying = computed(() => player.value?.state === 'playing')
const isIdle = computed(() => ['idle', 'off', 'standby', undefined].includes(player.value?.state))
const title = computed(() => player.value?.attributes.media_title as string | undefined)
const artist = computed(() => player.value?.attributes.media_artist as string | undefined)
const volume = computed(() => {
  const v = player.value?.attributes.volume_level as number | undefined
  return v != null ? Math.round(v * 100) : null
})

function service(name: string, data?: Record<string, unknown>) {
  call(name, data, { entity_id: props.config.entity })
}

function setVolume(e: Event) {
  service('volume_set', { volume_level: Number((e.target as HTMLInputElement).value) / 100 })
}
</script>

<template>
  <BaseCard :active="isPlaying">
    <div class="media-card">
      <div class="top">
        <MdiIcon :icon="isPlaying ? 'mdi:speaker-play' : 'mdi:speaker'" :size="28" />
        <div class="info">
          <div class="name">{{ displayName }}</div>
          <div class="track">
            <template v-if="!config.entity">{{ t('cards.common.noEntity') }}</template>
            <template v-else-if="!player">{{ t('cards.common.notFound') }}</template>
            <template v-else-if="isIdle">{{ t('cards.media.idle') }}</template>
            <template v-else>
              {{ title ?? t('cards.media.unknownTrack') }}<template v-if="artist"> · {{ artist }}</template>
            </template>
          </div>
        </div>
        <div v-if="player && !isIdle" class="controls" @click.stop>
          <button class="ctl-btn" @click="service('media_previous_track')">
            <MdiIcon icon="mdi:skip-previous" :size="20" />
          </button>
          <button class="ctl-btn" @click="service('media_play_pause')">
            <MdiIcon :icon="isPlaying ? 'mdi:pause' : 'mdi:play'" :size="22" />
          </button>
          <button class="ctl-btn" @click="service('media_next_track')">
            <MdiIcon icon="mdi:skip-next" :size="20" />
          </button>
        </div>
      </div>
      <div v-if="player && config.showVolume !== false && volume !== null" class="volume" @click.stop>
        <MdiIcon icon="mdi:volume-high" :size="16" />
        <input type="range" min="0" max="100" :value="volume" @change="setVolume" />
        <span class="vol-value">{{ volume }} %</span>
      </div>
    </div>
  </BaseCard>
</template>

<style scoped>
.media-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
}
.top {
  display: flex;
  align-items: center;
  gap: 12px;
}
.info {
  flex: 1;
  min-width: 0;
}
.name {
  font-weight: 600;
}
.track {
  font-size: 13px;
  opacity: 0.75;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.controls {
  display: flex;
  gap: 4px;
}
.ctl-btn {
  border: none;
  background: transparent;
  color: inherit;
  border-radius: 50%;
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.ctl-btn:hover {
  background: rgba(255, 255, 255, 0.12);
}
.volume {
  display: flex;
  align-items: center;
  gap: 8px;
}
.volume input[type='range'] {
  flex: 1;
}
.vol-value {
  font-size: 12px;
  opacity: 0.75;
  min-width: 36px;
  text-align: right;
}
</style>
