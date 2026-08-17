<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useEntity, useService } from '@/core/ha'
import { useDashboardStore, viewPath } from '@/core/config/dashboardStore'
import MdiIcon from '@/core/ui/MdiIcon.vue'

/**
 * Room tile: navigates to a (sub)view on tap. Optionally shows the room
 * temperature and a light-group toggle — like the room tiles in HA sections.
 */
const props = defineProps<{
  config: {
    name: string
    icon?: string
    targetView?: string
    temperatureEntity?: string
    lightGroup?: string
  }
}>()

const { t } = useI18n()
const router = useRouter()
const store = useDashboardStore()

const temp = useEntity(() => props.config.temperatureEntity)
const light = useEntity(() => props.config.lightGroup)
const { toggle } = useService('light')

const lightOn = computed(() => light.value?.state === 'on')
const tempText = computed(() => {
  if (!temp.value) return null
  const unit = (temp.value.attributes.unit_of_measurement as string | undefined) ?? '°C'
  return `${temp.value.state} ${unit}`
})

/** targetView holds a view id — the URL uses that view's path. */
function open() {
  const view = props.config.targetView ? store.viewById(props.config.targetView) : undefined
  if (view) router.push({ path: `/${viewPath(view)}` })
}

function toggleLight(e: Event) {
  e.stopPropagation()
  if (props.config.lightGroup) toggle(props.config.lightGroup)
}
</script>

<template>
  <div class="room-tile" @click="open">
    <div class="head">
      <MdiIcon :icon="config.icon || 'mdi:door-open'" :size="30" />
      <button
        v-if="config.lightGroup"
        class="light-toggle"
        :class="{ on: lightOn }"
        :title="t('cards.roomTile.toggleLights')"
        @click="toggleLight"
      >
        <MdiIcon :icon="lightOn ? 'mdi:lightbulb' : 'mdi:lightbulb-outline'" :size="18" />
      </button>
    </div>
    <div class="name">{{ config.name || t('cards.roomTile.defaultName') }}</div>
    <div class="meta">
      <span v-if="tempText">{{ tempText }}</span>
      <MdiIcon v-if="config.targetView" icon="mdi:chevron-right" :size="16" class="chev" />
    </div>
  </div>
</template>

<style scoped>
/* Tile */
.room-tile {
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
  flex-direction: column;
  gap: 8px;
}
.room-tile:active {
  transform: scale(0.98);
}
.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.light-toggle {
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
.light-toggle.on {
  background: var(--card-bg-active);
  color: var(--text-on-active);
  border-color: transparent;
}
.name {
  font-weight: 600;
  font-size: 15px;
}
.meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  opacity: 0.75;
  min-height: 16px;
}
.meta .chev {
  margin-left: auto;
}
</style>
