<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CardConfig, ViewConfig } from '@/core/config/types'
import CardPicker from '@/core/editor/CardPicker.vue'
import CardConfigDialog from '@/core/editor/CardConfigDialog.vue'
import SectionSettingsDialog from '@/core/editor/SectionSettingsDialog.vue'
import BaseAddTile from '@/core/ui/BaseAddTile.vue'
import { cardRegistry } from '@/core/registry/cardRegistry'
import LayoutSection from './LayoutSection.vue'
import { useSectionEditing } from './useSectionEditing'

/**
 * Flex layout: cards flow in wrapping rows and every card can get its
 * own FIXED pixel size — in edit mode simply drag the bottom-right
 * corner of a card (native CSS resize handle).
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

const { t } = useI18n()

/**
 * The view alignment positions the SECTIONS in the wrapping row — how the
 * cards sit inside a section is the section's own `contentAlign`.
 */
const justify: Record<string, string> = { left: 'flex-start', center: 'center', right: 'flex-end' }

// Unset means centred — that is what the view dialog shows as the default
const containerStyle = computed(() => ({
  justifyContent: justify[props.view.align ?? 'center'] ?? 'center',
}))

const flexContainer = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  gap: '12px',
}

/** Fixed per-card size — width defaults to 220px until the user resizes. */
function flexSlotStyle(card: CardConfig): Record<string, string> {
  const defaults = cardRegistry[card.type]?.defaultSize
  const style: Record<string, string> = {
    width: `${card.size?.width ?? defaults?.width ?? 140}px`,
    flex: '0 0 auto',
  }
  const height = card.size?.height ?? defaults?.height
  if (height) style.height = `${height}px`
  return style
}

function onResizeCard(cardId: string, width: number, height: number) {
  store.updateCardSize(props.view.id, cardId, { width, height })
}
</script>

<template>
  <div class="flex-layout" :style="containerStyle">
    <p v-if="store.editMode" class="resize-hint">{{ t('editor.flexResizeHint') }}</p>

    <LayoutSection
      v-for="section in view.sections"
      :key="section.id"
      :section="section"
      :edit-mode="store.editMode"
      :dragging-id="draggingId"
      :drop-target="dropTarget"
      :grid-style="flexContainer"
      :slot-style="flexSlotStyle"
      :section-dragging="draggingSectionId === section.id"
      :section-drop-target="sectionDropId === section.id"
      resizable
      @pick="pickerSectionId = $event"
      @edit-card="editCard"
      @remove-card="removeCard"
      @duplicate-card="duplicateCard"
      @copy-card="copyCard"
      @cut-card="cutCard"
      @resize-card="onResizeCard"
      @edit-section="editSection"
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

    <CardPicker v-if="pickerSectionId" @close="pickerSectionId = null" @pick="onPick" />
    <CardConfigDialog
      v-if="configTarget"
      :card-type="configTarget.cardType"
      :initial-config="configTarget.mode === 'edit' ? configTarget.config : (configTarget.initialConfig ?? {})"
      :initial-css="configTarget.mode === 'edit' ? configTarget.css : undefined"
      :initial-size="configTarget.mode === 'edit' ? cardById(configTarget.cardId)?.size : undefined"
      sizable
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
/* Sections flow in rows: full-width ones claim a row of their own,
   sections with a fixed width sit next to each other. */
.flex-layout {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 20px;
  max-width: var(--view-max-width, 1400px);
  /* --view-align holds the auto margins of the view's alignment setting */
  margin: var(--view-align, 0 auto);
}
/* Default for every child; sections with a fixed width override it inline */
.flex-layout > * {
  flex: 1 1 100%;
  min-width: 0;
}
.resize-hint {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
}
</style>
