<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useDashboardStore } from '@/core/config/dashboardStore'
import MdiIcon from '@/core/ui/MdiIcon.vue'

const { t } = useI18n()
const store = useDashboardStore()
</script>

<template>
  <button
    class="edit-fab"
    :class="{ active: store.editMode }"
    :title="store.editMode ? t('editor.stopEditing') : t('editor.startEditing')"
    @click="store.editMode = !store.editMode"
  >
    <MdiIcon :icon="store.editMode ? 'mdi:check' : 'mdi:pencil'" :size="24" />
  </button>
</template>

<style scoped>
.edit-fab {
  position: fixed;
  right: 24px;
  bottom: 24px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  background: var(--card-bg);
  color: var(--text-secondary);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  cursor: pointer;
  display: grid;
  place-items: center;
  z-index: 50;
  transition: background 0.2s, color 0.2s;
}
.edit-fab.active {
  background: var(--accent);
  color: var(--text-on-active);
}
</style>
