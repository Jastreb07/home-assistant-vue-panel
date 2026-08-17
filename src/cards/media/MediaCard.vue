<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEntity, useService } from '@/core/ha'
import MdiIcon from '@/core/ui/MdiIcon.vue'
import OverflowMarquee from '@/core/ui/OverflowMarquee.vue'

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
  <div class="media-card" :class="{ active: isPlaying }">
    <div class="top">
      <MdiIcon :icon="isPlaying ? 'mdi:speaker-play' : 'mdi:speaker'" :size="28" />
      <div class="info">
        <OverflowMarquee class="name" :text="displayName" />
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
</template>

<style scoped>
/* Tile */
.media-card {
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
  gap: 3px;
}
.media-card.active {
  background: #f6d36b;
  color: #111111;
}
.top {
  min-height: 0;
  flex: 1;
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
.media-card.active .top > .mdi {
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
.track {
  margin-top: 3px;
  font-size: 11px;
  line-height: 1.2;
  color: #666666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.controls {
  position: absolute;
  top: 16px;
  right: 10px;
  display: flex;
  gap: 0;
}
.ctl-btn {
  border: none;
  background: transparent;
  color: inherit;
  border-radius: 50%;
  width: 20px;
  height: 20px;
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
  gap: 3px;
  min-height: 14px;
}
.volume input[type='range'] {
  flex: 1;
}
.vol-value {
  font-size: 9px;
  color: #666666;
  min-width: 27px;
  text-align: right;
}
</style>
