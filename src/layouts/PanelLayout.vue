<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ViewConfig } from '@/core/config/types'
import { resolveCardComponent } from '@/core/registry/cardRegistry'
import CardPicker from '@/core/editor/CardPicker.vue'
import CardConfigDialog from '@/core/editor/CardConfigDialog.vue'
import MdiIcon from '@/core/ui/MdiIcon.vue'
import BaseAddTile from '@/core/ui/BaseAddTile.vue'
import CardCss from '@/core/ui/CardCss.vue'
import { useSectionEditing } from './useSectionEditing'

/**
 * Panel layout (like the HA "panel" view): a single card fills the
 * entire view. Only the first card of the first section is rendered.
 */
const props = defineProps<{ view: ViewConfig }>()

const {
  store,
  pickerSectionId,
  configTarget,
  onPick,
  onConfigSave,
  editCard,
  removeCard,
} = useSectionEditing(() => props.view)

const { t } = useI18n()

const firstSection = computed(() => props.view.sections[0])
const panelCard = computed(() => firstSection.value?.cards[0])
</script>

<template>
  <div class="panel-layout">
    <template v-if="panelCard">
      <div class="panel-slot" :data-vp-card="panelCard.css ? panelCard.id : undefined">
        <CardCss v-if="panelCard.css" :card-id="panelCard.id" :css="panelCard.css" />
        <component
          :is="resolveCardComponent(panelCard.type)"
          v-if="resolveCardComponent(panelCard.type)"
          :config="panelCard.config"
        />
        <div v-else class="unknown-card">{{ t('editor.unknownCard', { type: panelCard.type }) }}</div>

        <div v-if="store.editMode" class="card-edit-overlay">
          <button class="icon-btn" :title="t('editor.configure')" @click.stop="editCard(panelCard)">
            <MdiIcon icon="mdi:cog" :size="18" />
          </button>
          <button class="icon-btn" :title="t('common.delete')" @click.stop="removeCard(panelCard.id)">
            <MdiIcon icon="mdi:delete-outline" :size="18" />
          </button>
        </div>
      </div>
    </template>

    <BaseAddTile
      v-else-if="store.editMode && firstSection"
      size="lg"
      fill
      :label="t('editor.addCard')"
      @click="pickerSectionId = firstSection.id"
    />

    <div v-else class="empty">{{ t('editor.panelEmpty') }}</div>

    <CardPicker v-if="pickerSectionId" @close="pickerSectionId = null" @pick="onPick" />
    <CardConfigDialog
      v-if="configTarget"
      :card-type="configTarget.cardType"
      :initial-config="configTarget.mode === 'edit' ? configTarget.config : {}"
      :initial-css="configTarget.mode === 'edit' ? configTarget.css : undefined"
      @close="configTarget = null"
      @save="onConfigSave"
    />
  </div>
</template>

<style scoped>
.panel-layout {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.panel-slot {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 60vh;
}
.panel-slot > :first-child {
  flex: 1;
}
.card-edit-overlay {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  gap: 4px;
  background: rgba(0, 0, 0, 0.55);
  border-radius: 10px;
  padding: 3px;
  z-index: 2;
}
.icon-btn {
  border: none;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: grid;
  place-items: center;
}
.icon-btn:hover {
  background: rgba(255, 255, 255, 0.12);
}
.unknown-card {
  border: 2px dashed var(--divider);
  border-radius: var(--card-radius);
  padding: 16px;
  color: var(--text-secondary);
}
.empty {
  flex: 1;
  display: grid;
  place-items: center;
  color: var(--text-secondary);
}
</style>
