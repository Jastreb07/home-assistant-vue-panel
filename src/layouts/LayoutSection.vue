<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { CardConfig, SectionConfig } from '@/core/config/types'
import { resolveCardComponent } from '@/core/registry/cardRegistry'
import MdiIcon from '@/core/ui/MdiIcon.vue'
import BaseAddTile from '@/core/ui/BaseAddTile.vue'
import CardCss from '@/core/ui/CardCss.vue'

/**
 * Renders one section (header + cards grid + edit overlays).
 * Shared by the sections / tiles / grid / sidebar layouts —
 * the grid itself is styled by the parent via `gridStyle`.
 */
defineProps<{
  section: SectionConfig
  editMode: boolean
  draggingId: string | null
  dropTarget: { sectionId: string; index: number } | null
  /** CSS for the cards grid, e.g. grid-template-columns */
  gridStyle?: Record<string, string>
  /** Hide the section header entirely (tiles layout) */
  hideHeader?: boolean
}>()

const emit = defineEmits<{
  pick: [sectionId: string]
  'edit-card': [card: CardConfig]
  'remove-card': [cardId: string]
  'rename-section': [section: SectionConfig]
  'remove-section': [section: SectionConfig]
  dragstart: [e: DragEvent, cardId: string]
  'dragover-card': [e: DragEvent, sectionId: string, index: number]
  'dragover-section': [e: DragEvent, section: SectionConfig]
  drop: [e: DragEvent]
  dragend: []
}>()

const { t } = useI18n()

function slotStyle(card: CardConfig): Record<string, string> | undefined {
  return card.size ? { gridColumn: `span ${card.size.cols}` } : undefined
}
</script>

<template>
  <section
    class="layout-section"
    @dragover="editMode && emit('dragover-section', $event, section)"
    @drop="editMode && emit('drop', $event)"
  >
    <header v-if="!hideHeader && (section.title || editMode)" class="section-header">
      <MdiIcon v-if="section.icon" :icon="section.icon" :size="20" />
      <h2>{{ section.title ?? t('editor.untitledSection') }}</h2>
      <template v-if="editMode">
        <button class="icon-btn" :title="t('editor.rename')" @click="emit('rename-section', section)">
          <MdiIcon icon="mdi:pencil" :size="16" />
        </button>
        <button class="icon-btn" :title="t('editor.deleteSection')" @click="emit('remove-section', section)">
          <MdiIcon icon="mdi:delete-outline" :size="16" />
        </button>
      </template>
      <div class="rule" />
    </header>

    <div class="cards-grid" :style="gridStyle">
      <template v-for="(card, index) in section.cards" :key="card.id">
        <div
          class="card-slot"
          :class="{
            dragging: draggingId === card.id,
            'drop-before': dropTarget?.sectionId === section.id && dropTarget?.index === index,
          }"
          :style="slotStyle(card)"
          :data-vp-card="card.css ? card.id : undefined"
          :draggable="editMode"
          @dragstart="emit('dragstart', $event, card.id)"
          @dragover="editMode && emit('dragover-card', $event, section.id, index)"
          @dragend="emit('dragend')"
        >
          <CardCss v-if="card.css" :card-id="card.id" :css="card.css" />
          <component
            :is="resolveCardComponent(card.type)"
            v-if="resolveCardComponent(card.type)"
            :config="card.config"
          />
          <div v-else class="unknown-card">{{ t('editor.unknownCard', { type: card.type }) }}</div>

          <div v-if="editMode" class="card-edit-overlay">
            <button class="icon-btn" :title="t('editor.configure')" @click.stop="emit('edit-card', card)">
              <MdiIcon icon="mdi:cog" :size="18" />
            </button>
            <button class="icon-btn" :title="t('common.delete')" @click.stop="emit('remove-card', card.id)">
              <MdiIcon icon="mdi:delete-outline" :size="18" />
            </button>
          </div>
        </div>
      </template>

      <BaseAddTile
        v-if="editMode"
        :label="t('editor.addCard')"
        @click="emit('pick', section.id)"
      />
    </div>
  </section>
</template>

<style scoped>
.section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}
.section-header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--text-secondary);
}
.section-header .rule {
  flex: 1;
  height: 2px;
  background: var(--divider);
  border-radius: 1px;
}
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}
.card-slot {
  position: relative;
}
.card-slot.dragging {
  opacity: 0.4;
}
.card-slot.drop-before {
  outline: 2px dashed var(--accent);
  outline-offset: 4px;
  border-radius: var(--card-radius);
}
.card-edit-overlay {
  position: absolute;
  top: 6px;
  right: 6px;
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
</style>
