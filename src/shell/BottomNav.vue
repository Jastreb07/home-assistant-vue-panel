<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ViewConfig } from '@/core/config/types'
import MdiIcon from '@/core/ui/MdiIcon.vue'

defineProps<{
  views: ViewConfig[]
  activeId?: string
  editMode?: boolean
}>()
const emit = defineEmits<{ navigate: [viewId: string]; addView: [] }>()

const { t } = useI18n()
</script>

<template>
  <nav class="bottom-nav">
    <button
      v-for="view in views"
      :key="view.id"
      class="tab"
      :class="{ active: view.id === activeId }"
      @click="emit('navigate', view.id)"
    >
      <MdiIcon :icon="view.icon" :size="24" />
      <span class="label">{{ view.title }}</span>
    </button>
    <button v-if="editMode" class="tab" @click="emit('addView')">
      <MdiIcon icon="mdi:plus" :size="24" />
      <span class="label">{{ t('shell.new') }}</span>
    </button>
  </nav>
</template>

<style scoped>
.bottom-nav {
  flex-shrink: 0;
  display: flex;
  background: var(--nav-bg);
  border-top: 1px solid var(--divider);
  padding-bottom: env(safe-area-inset-bottom);
}
.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px 4px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 11px;
  cursor: pointer;
}
.tab.active {
  color: var(--accent);
}
</style>
