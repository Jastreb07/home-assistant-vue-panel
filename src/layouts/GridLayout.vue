<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ViewConfig } from '@/core/config/types'
import CardPicker from '@/core/editor/CardPicker.vue'
import CardConfigDialog from '@/core/editor/CardConfigDialog.vue'
import BaseAddTile from '@/core/ui/BaseAddTile.vue'
import LayoutSection from './LayoutSection.vue'
import { useSectionEditing } from './useSectionEditing'

/**
 * Grid layout: fixed number of columns (layoutOptions.columns, default 4).
 * Card sizes (cols/rows) span grid cells precisely — best for kiosk screens.
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

const columns = computed(() => {
  const c = Number(props.view.layoutOptions?.columns)
  return Number.isFinite(c) && c >= 1 ? Math.min(c, 12) : 4
})

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${columns.value}, 1fr)`,
  gap: '16px',
}))
</script>

<template>
  <div class="grid-layout">
    <LayoutSection
      v-for="section in view.sections"
      :key="section.id"
      :section="section"
      :edit-mode="store.editMode"
      :dragging-id="draggingId"
      :drop-target="dropTarget"
      :grid-style="gridStyle"
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

    <BaseAddTile
      v-if="store.editMode"
      variant="pill"
      orientation="horizontal"
      :label="t('editor.addSection')"
      @click="addSection"
    />

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
.grid-layout {
  display: flex;
  flex-direction: column;
  gap: 32px;
  max-width: 1400px;
  margin: 0 auto;
}
</style>
