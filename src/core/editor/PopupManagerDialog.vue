<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PopupConfig } from '@/core/config/types'
import { useDashboardStore } from '@/core/config/dashboardStore'
import BaseDialog from '@/core/ui/BaseDialog.vue'
import BaseAddTile from '@/core/ui/BaseAddTile.vue'
import MdiIcon from '@/core/ui/MdiIcon.vue'
import { confirmDialog } from '@/core/ui/dialogService'
import PopupSettingsDialog from './PopupSettingsDialog.vue'

/**
 * Custom popups of this dashboard: create them, order them, edit their cards
 * and hand them to a tap action. They exist panel-wide, not per view.
 */
const emit = defineEmits<{ close: []; editCards: [popupId: string] }>()

const { t } = useI18n()
const store = useDashboardStore()
const settingsTarget = ref<PopupConfig | null>(null)

function add() {
  settingsTarget.value = store.addPopup(t('editor.popup.untitled'))
}

/**
 * Cards are edited in the popup itself — it is a flex view in a dialog. The
 * shell opens it so this manager can come back once the popup is closed.
 */
function editCards(popup: PopupConfig) {
  emit('editCards', popup.id)
}

async function remove(popup: PopupConfig) {
  if (!(await confirmDialog(t('editor.popup.deleteConfirm')))) return
  store.removePopup(popup.id)
}
</script>

<template>
  <BaseDialog :title="t('editor.popup.managerTitle')" size="lg" @close="emit('close')">
    <p class="hint">{{ t('editor.popup.managerHint') }}</p>

    <ul v-if="store.popups.length" class="popups">
      <li v-for="(popup, index) in store.popups" :key="popup.id" class="popup">
        <MdiIcon :icon="popup.icon || 'mdi:card-text-outline'" :size="20" />
        <span class="name">{{ popup.title }}</span>
        <span class="count">{{ t('editor.popup.cardCount', {
          count: popup.sections.reduce((total, section) => total + section.cards.length, 0),
        }) }}</span>
        <div class="actions">
          <button
            class="icon-btn"
            :disabled="index === 0"
            :title="t('editor.popup.moveUp')"
            @click="store.movePopup(popup.id, -1)"
          >
            <MdiIcon icon="mdi:chevron-up" :size="17" />
          </button>
          <button
            class="icon-btn"
            :disabled="index === store.popups.length - 1"
            :title="t('editor.popup.moveDown')"
            @click="store.movePopup(popup.id, 1)"
          >
            <MdiIcon icon="mdi:chevron-down" :size="17" />
          </button>
          <button class="icon-btn" :title="t('editor.popup.editCards')" @click="editCards(popup)">
            <MdiIcon icon="mdi:view-dashboard-edit-outline" :size="17" />
          </button>
          <button class="icon-btn" :title="t('editor.popup.settings')" @click="settingsTarget = popup">
            <MdiIcon icon="mdi:cog" :size="17" />
          </button>
          <button class="icon-btn" :title="t('editor.popup.duplicate')" @click="store.duplicatePopup(popup.id)">
            <MdiIcon icon="mdi:content-copy" :size="16" />
          </button>
          <button class="icon-btn" :title="t('common.delete')" @click="remove(popup)">
            <MdiIcon icon="mdi:delete-outline" :size="17" />
          </button>
        </div>
      </li>
    </ul>
    <p v-else class="hint">{{ t('editor.popup.empty') }}</p>

    <BaseAddTile
      variant="pill"
      orientation="horizontal"
      :label="t('editor.popup.add')"
      class="add"
      @click="add"
    />
  </BaseDialog>

  <PopupSettingsDialog
    v-if="settingsTarget"
    :popup="settingsTarget"
    @close="settingsTarget = null"
    @remove="settingsTarget && store.removePopup(settingsTarget.id)"
  />
</template>

<style scoped>
.hint {
  margin: 0 0 14px;
  color: var(--text-secondary);
  font-size: 13px;
}
.popups {
  display: grid;
  gap: 8px;
  margin: 0 0 16px;
  padding: 0;
  list-style: none;
}
.popup {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--divider);
  border-radius: 10px;
  background: var(--card-bg);
}
.name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
}
.count {
  color: var(--text-secondary);
  font-size: 12px;
}
.actions {
  display: flex;
  gap: 4px;
}
.icon-btn {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 1px solid var(--divider);
  border-radius: 8px;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
}
.icon-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
.icon-btn:not(:disabled):hover {
  border-color: var(--accent);
}
.add {
  align-self: start;
}
</style>
