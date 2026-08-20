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
 * Sections layout (like HA "Sections"): sections are real columns that
 * flow next to each other. layoutOptions:
 *  - maxColumns: max sections side by side (default 4)
 *  - dense:      masonry-like packing to fill vertical gaps
 *  - topMargin:  extra space at the top (shows more background)
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

const { t } = useI18n()

const SECTION_MIN = 330
const GAP = 24

const maxColumns = computed(() => {
  const n = Number(props.view.layoutOptions?.maxColumns)
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 6) : 4
})
const dense = computed(() => props.view.layoutOptions?.dense === true)
const topMargin = computed(() => props.view.layoutOptions?.topMargin === true)

/** Section width in columns — capped by the view's maximum, ignored while dense. */
function spanFor(section: { columnSpan?: number }): number | undefined {
  if (dense.value) return undefined
  const span = Math.round(section.columnSpan ?? 1)
  return span > 1 ? Math.min(span, maxColumns.value) : undefined
}

/**
 * Columns the sections actually occupy (add tile included while editing).
 * The container never claims more width than that — otherwise the alignment
 * setting of the view would have nothing to move.
 */
const usedColumns = computed(() => {
  let cols = store.editMode ? 1 : 0
  for (const section of props.view.sections) {
    cols += Math.min(Math.max(Math.round(section.columnSpan ?? 1), 1), maxColumns.value)
  }
  return Math.max(1, Math.min(cols, maxColumns.value))
})

const containerStyle = computed(() => {
  const columns = usedColumns.value
  // Room for the section toolbars anchored at `top: -40px` above each row
  const rowGap = store.editMode ? 45 : GAP
  const base: Record<string, string> = {
    // The view's "full width" setting overrides the column-based maximum
    maxWidth: `var(--view-max-width, ${columns * SECTION_MIN + (columns - 1) * GAP}px)`,
    ...(topMargin.value ? { paddingTop: '80px' } : {}),
  }
  if (dense.value) {
    // Masonry-like packing via CSS multi-columns
    return { ...base, columnCount: String(columns), columnGap: `${GAP}px` }
  }
  return {
    ...base,
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${SECTION_MIN}px), 1fr))`,
    gap: `${rowGap}px ${GAP}px`,
    alignItems: 'start',
  }
})
</script>

<template>
  <div class="sections-layout" :class="{ dense, 'is-editing': store.editMode }" :style="containerStyle">
    <LayoutSection
      v-for="section in view.sections"
      :key="section.id"
      :section="section"
      :edit-mode="store.editMode"
      :dragging-id="draggingId"
      :drop-target="dropTarget"
      :section-dragging="draggingSectionId === section.id"
      :section-drop-target="sectionDropId === section.id"
      :column-span="spanFor(section)"
      :cards-per-row="section.cardsPerRow"
      @pick="pickerSectionId = $event"
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
      class="add-section"
      :label="t('editor.addSection')"
      @click="addSection"
    />
    <BaseAddTile
      v-if="store.editMode && hasSectionClipboard"
      class="add-section"
      :label="t('editor.pasteSection')"
      @click="pasteSection"
    />

    <CardPicker v-if="pickerSectionId" @close="pickerSectionId = null" @pick="onPick" />
    <CardConfigDialog
      v-if="configTarget"
      :card-type="configTarget.cardType"
      :initial-config="configTarget.mode === 'edit' ? configTarget.config : (configTarget.initialConfig ?? {})"
      :initial-css="configTarget.mode === 'edit' ? configTarget.css : undefined"
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
.sections-layout {
  /* --view-align holds the auto margins of the view's alignment setting */
  margin: var(--view-align, 0 auto);
}
/* Multi-column (dense) mode: keep sections in one piece and add row spacing */
.sections-layout.dense .layout-section,
.sections-layout.dense .add-section {
  break-inside: avoid;
  margin-bottom: 24px;
  width: 100%;
}
/* Room for the section toolbars anchored at `top: -40px` above each section */
.sections-layout.dense.is-editing .layout-section,
.sections-layout.dense.is-editing .add-section {
  margin-bottom: 45px;
}
.add-section {
  min-height: 120px;
}
</style>
