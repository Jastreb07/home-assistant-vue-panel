<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ViewConfig } from '@/core/config/types'
import CardPicker from '@/core/editor/CardPicker.vue'
import CardConfigDialog from '@/core/editor/CardConfigDialog.vue'
import MdiIcon from '@/core/ui/MdiIcon.vue'
import LayoutSection from './LayoutSection.vue'
import { useSectionEditing } from './useSectionEditing'

/**
 * Tiles layout: dense grid of small tiles without section headers.
 * Ideal for wall tablets with many quick-access toggles.
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
  addSection,
  renameSection,
  removeSection,
  draggingId,
  dropTarget,
  onDragStart,
  onDragOverCard,
  onDragOverSection,
  onDrop,
  onDragEnd,
} = useSectionEditing(() => props.view)

const { t } = useI18n()

const tileGrid = {
  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
  gap: '12px',
}
</script>

<template>
  <div class="tiles-layout">
    <LayoutSection
      v-for="section in view.sections"
      :key="section.id"
      :section="section"
      :edit-mode="store.editMode"
      :dragging-id="draggingId"
      :drop-target="dropTarget"
      :grid-style="tileGrid"
      :hide-header="!store.editMode"
      @pick="pickerSectionId = $event"
      @edit-card="editCard"
      @remove-card="removeCard"
      @rename-section="renameSection"
      @remove-section="removeSection"
      @dragstart="onDragStart"
      @dragover-card="onDragOverCard"
      @dragover-section="onDragOverSection"
      @drop="onDrop"
      @dragend="onDragEnd"
    />

    <button v-if="store.editMode" class="add-section-btn" @click="addSection">
      <MdiIcon icon="mdi:plus" :size="20" />
      {{ t('editor.addSection') }}
    </button>

    <CardPicker v-if="pickerSectionId" @close="pickerSectionId = null" @pick="onPick" />
    <CardConfigDialog
      v-if="configTarget"
      :card-type="configTarget.cardType"
      :initial-config="configTarget.mode === 'edit' ? configTarget.config : {}"
      @close="configTarget = null"
      @save="onConfigSave"
    />
  </div>
</template>

<style scoped>
.tiles-layout {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 1400px;
  margin: 0 auto;
}
.add-section-btn {
  align-self: center;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border: 2px dashed var(--divider);
  border-radius: 24px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
}
.add-section-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}
</style>
