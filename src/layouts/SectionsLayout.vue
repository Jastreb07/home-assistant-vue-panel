<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ViewConfig } from '@/core/config/types'
import CardPicker from '@/core/editor/CardPicker.vue'
import CardConfigDialog from '@/core/editor/CardConfigDialog.vue'
import MdiIcon from '@/core/ui/MdiIcon.vue'
import LayoutSection from './LayoutSection.vue'
import { useSectionEditing } from './useSectionEditing'

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
</script>

<template>
  <div class="sections-layout">
    <LayoutSection
      v-for="section in view.sections"
      :key="section.id"
      :section="section"
      :edit-mode="store.editMode"
      :dragging-id="draggingId"
      :drop-target="dropTarget"
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
.sections-layout {
  display: flex;
  flex-direction: column;
  gap: 32px;
  max-width: 1200px;
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
  transition: border-color 0.15s, color 0.15s;
}
.add-section-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}
</style>
