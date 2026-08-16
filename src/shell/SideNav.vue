<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ViewConfig } from '@/core/config/types'
import { useClock } from '@/core/composables/useClock'
import { useDashboardStore } from '@/core/config/dashboardStore'
import MdiIcon from '@/core/ui/MdiIcon.vue'
import NavCards from './NavCards.vue'

defineProps<{
  views: ViewConfig[]
  activeId?: string
  editMode?: boolean
}>()
const emit = defineEmits<{ navigate: [viewId: string]; addView: [] }>()

const { t, locale } = useI18n()
const store = useDashboardStore()
const now = useClock()
const time = computed(() =>
  now.value.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' }),
)
const date = computed(() =>
  now.value.toLocaleDateString(locale.value, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }),
)
</script>

<template>
  <nav class="side-nav" :style="{ width: store.nav.width + 'px' }">
    <div v-if="store.nav.showClock" class="clock">
      <div class="time">{{ time }}</div>
      <div class="date">{{ date }}</div>
    </div>

    <NavCards v-if="store.nav.cardsPosition === 'top'" direction="column" />

    <ul class="views">
      <li v-for="view in views" :key="view.id">
        <button
          class="view-btn"
          :class="{ active: view.id === activeId }"
          @click="emit('navigate', view.id)"
        >
          <span class="title">{{ view.title }}</span>
          <MdiIcon :icon="view.icon" :size="22" />
        </button>
      </li>
      <li v-if="editMode">
        <button class="view-btn add" @click="emit('addView')">
          <span class="title">{{ t('shell.newView') }}</span>
          <MdiIcon icon="mdi:plus" :size="22" />
        </button>
      </li>
    </ul>

    <NavCards v-if="store.nav.cardsPosition === 'bottom'" direction="column" class="bottom-cards" />
  </nav>
</template>

<style scoped>
.side-nav {
  /* width comes from nav.width */
  flex-shrink: 0;
  background: var(--nav-bg);
  display: flex;
  flex-direction: column;
  padding: 24px 16px;
  gap: 32px;
  overflow-y: auto;
}
/* Keep trailing cards pinned to the bottom of the nav */
.bottom-cards {
  margin-top: auto;
}
.clock .time {
  font-size: 64px;
  font-weight: 200;
  line-height: 1;
}
.clock .date {
  margin-top: 8px;
  color: var(--text-secondary);
}
.views {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.view-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  border: none;
  border-radius: 28px;
  background: transparent;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}
.view-btn:hover {
  background: var(--nav-item-hover);
}
.view-btn.active {
  background: var(--nav-item-active);
}
.view-btn.add {
  border: 2px dashed var(--divider);
  color: var(--text-secondary);
}
.view-btn.add:hover {
  border-color: var(--accent);
  color: var(--accent);
}
</style>
