<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ViewConfig } from '@/core/config/types'
import CardPicker from '@/core/editor/CardPicker.vue'
import CardConfigDialog from '@/core/editor/CardConfigDialog.vue'
import SectionSettingsDialog from '@/core/editor/SectionSettingsDialog.vue'
import BaseAddTile from '@/core/ui/BaseAddTile.vue'
import LayoutSection from './LayoutSection.vue'
import { useSectionEditing } from './useSectionEditing'

/**
 * Sidebar layout (like the HA "sidebar" view): a wide main column plus
 * a narrow right column. The LAST section is rendered in the sidebar,
 * all other sections in the main column. On narrow screens the columns stack.
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
  duplicateCard,
  copyCard,
  cutCard,
  cardById,
  sectionTarget,
  addSection,
  editSection,
  duplicateSection,
  copySection,
  hasSectionClipboard,
  pasteSection,
  onSectionSave,
  onSectionRemove,
  removeSection,
  draggingId,
  dropTarget,
  draggingSectionId,
  sectionDropId,
  onDragStart,
  onSectionDragStart,
  onDragOverCard,
  onDragOverSection,
  onDrop,
  onDragEnd,
} = useSectionEditing(() => props.view)

/** Home Assistant cards are resizable in every layout — see LayoutSection. */
function onResizeCard(cardId: string, width: number, height: number) {
  store.updateCardSize(props.view.id, cardId, { width, height })
}

const { t } = useI18n()

const mainSections = computed(() =>
  props.view.sections.length > 1 ? props.view.sections.slice(0, -1) : props.view.sections,
)
const sidebarSection = computed(() =>
  props.view.sections.length > 1 ? props.view.sections[props.view.sections.length - 1] : undefined,
)

const sidebarGrid = { gridTemplateColumns: '1fr', gap: '16px' }
</script>

<template>
  <div class="sidebar-layout" :class="{ 'has-sidebar': sidebarSection }">
    <div class="main-col">
      <LayoutSection
        v-for="section in mainSections"
        :key="section.id"
        :section="section"
        :edit-mode="store.editMode"
        :dragging-id="draggingId"
        :drop-target="dropTarget"
        :section-dragging="draggingSectionId === section.id"
        :section-drop-target="sectionDropId === section.id"
        @pick="pickerSectionId = $event"
        @resize-card="onResizeCard"
        @edit-card="editCard"
        @remove-card="removeCard"
        @duplicate-card="duplicateCard"
        @copy-card="copyCard"
        @cut-card="cutCard"
        @edit-section="editSection"
        @duplicate-section="duplicateSection"
        @copy-section="copySection"
        @remove-section="removeSection"
        @section-dragstart="onSectionDragStart"
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
      <BaseAddTile
        v-if="store.editMode && hasSectionClipboard"
        variant="pill"
        orientation="horizontal"
        :label="t('editor.pasteSection')"
        @click="pasteSection"
      />
      <p v-if="store.editMode" class="hint">{{ t('editor.sidebarHint') }}</p>
    </div>

    <aside v-if="sidebarSection" class="side-col">
      <LayoutSection
        :section="sidebarSection"
        :edit-mode="store.editMode"
        :dragging-id="draggingId"
        :drop-target="dropTarget"
        :grid-style="sidebarGrid"
        @pick="pickerSectionId = $event"
        @resize-card="onResizeCard"
        @edit-card="editCard"
        @remove-card="removeCard"
        @duplicate-card="duplicateCard"
        @copy-card="copyCard"
        @cut-card="cutCard"
        @edit-section="editSection"
        @duplicate-section="duplicateSection"
        @copy-section="copySection"
        @remove-section="removeSection"
        @dragstart="onDragStart"
        @dragover-card="onDragOverCard"
        @dragover-section="onDragOverSection"
        @drop="onDrop"
        @dragend="onDragEnd"
      />
    </aside>

    <CardPicker v-if="pickerSectionId" @close="pickerSectionId = null" @pick="onPick" />
    <CardConfigDialog
      v-if="configTarget"
      :card-type="configTarget.cardType"
      :initial-config="configTarget.mode === 'edit' ? configTarget.config : (configTarget.initialConfig ?? {})"
      :initial-css="configTarget.mode === 'edit' ? configTarget.css : undefined"
      :initial-visibility="configTarget.mode === 'edit' ? configTarget.visibility : undefined"
      :initial-size="configTarget.mode === 'edit' ? cardById(configTarget.cardId)?.size : undefined"
      @close="configTarget = null"
      @save="onConfigSave"
    />
    <SectionSettingsDialog
      v-if="sectionTarget"
      :section="sectionTarget"
      :view="view"
      @close="sectionTarget = null"
      @save="onSectionSave"
      @remove="onSectionRemove"
    />
  </div>
</template>

<style scoped>
.sidebar-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  max-width: var(--view-max-width, 1400px);
  /* --view-align holds the auto margins of the view's alignment setting */
  margin: var(--view-align, 0 auto);
  align-items: start;
}
@media (min-width: 900px) {
  .sidebar-layout.has-sidebar {
    grid-template-columns: 1fr 320px;
  }
}
.main-col {
  display: flex;
  flex-direction: column;
  gap: 32px;
  min-width: 0;
}
.side-col {
  min-width: 0;
}
.hint {
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
}
</style>
