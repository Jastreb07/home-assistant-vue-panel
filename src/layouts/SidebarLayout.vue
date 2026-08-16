<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ViewConfig } from '@/core/config/types'
import CardPicker from '@/core/editor/CardPicker.vue'
import CardConfigDialog from '@/core/editor/CardConfigDialog.vue'
import MdiIcon from '@/core/ui/MdiIcon.vue'
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
    </aside>

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
.sidebar-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  max-width: 1400px;
  margin: 0 auto;
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
.hint {
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
}
</style>
