<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CardConfig, SectionConfig } from '@/core/config/types'
import {
  cardDefaultVisibility,
  cardRegistry,
  resolveCardComponent,
  type CardArea,
} from '@/core/registry/cardRegistry'
import { visibilityMediaCss } from '@/core/ui/responsiveCss'
import MdiIcon from '@/core/ui/MdiIcon.vue'
import BaseAddTile from '@/core/ui/BaseAddTile.vue'
import BaseCardEditOverlay from '@/core/ui/BaseCardEditOverlay.vue'
import BaseEditableArea from '@/core/ui/BaseEditableArea.vue'
import BaseEditableAreaButton from '@/core/ui/BaseEditableAreaButton.vue'
import CardCss from '@/core/ui/CardCss.vue'
import { boxToCss } from '@/core/ui/boxInput'

/**
 * Renders one section (cards grid + edit overlays). Shared by the
 * sections / flex / grid / sidebar layouts — the grid itself is styled by
 * the parent via `gridStyle`. Headings are cards (`vue-panel/section-title`).
 */
const props = defineProps<{
  section: SectionConfig
  editMode: boolean
  draggingId: string | null
  dropTarget: { sectionId: string; index: number } | null
  /** CSS for the cards grid, e.g. grid-template-columns (or display:flex) */
  gridStyle?: Record<string, string>
  /** Exact columns for this section; only supplied by the sections layout. */
  cardsPerRow?: number
  /** Per-card slot style override (e.g. fixed px sizes in the flex layout) */
  slotStyle?: (card: CardConfig) => Record<string, string> | undefined
  /** Allow resizing card slots in edit mode (flex layout) */
  resizable?: boolean
  /** This section is currently being dragged (reorder) */
  sectionDragging?: boolean
  /** A dragged section would be dropped at this section's position */
  sectionDropTarget?: boolean
  /** Width in grid columns — only meaningful in a column-based parent */
  columnSpan?: number
  /** Where these cards sit — 'dialog' for popups, 'dashboard' for views */
  area?: CardArea
}>()

const emit = defineEmits<{
  pick: [sectionId: string]
  'edit-card': [card: CardConfig]
  'remove-card': [cardId: string]
  'duplicate-card': [cardId: string]
  'copy-card': [card: CardConfig]
  'cut-card': [card: CardConfig]
  'resize-card': [cardId: string, width: number, height: number]
  'edit-section': [section: SectionConfig]
  'remove-section': [section: SectionConfig]
  'duplicate-section': [section: SectionConfig]
  'copy-section': [section: SectionConfig]
  'section-dragstart': [e: DragEvent, sectionId: string]
  dragstart: [e: DragEvent, cardId: string]
  'dragover-card': [e: DragEvent, sectionId: string, index: number]
  'dragover-section': [e: DragEvent, section: SectionConfig]
  drop: [e: DragEvent]
  dragend: []
}>()

const { t } = useI18n()

/** Spacing and column width configured in the section settings dialog. */
const sectionStyle = computed(() => {
  const style: Record<string, string> = {}
  const padding = boxToCss(props.section.padding)
  const margin = boxToCss(props.section.margin)
  if (padding) style.padding = padding
  if (margin) style.margin = margin
  if (props.columnSpan && props.columnSpan > 1) style.gridColumn = `span ${props.columnSpan}`
  if (props.section.width) {
    // `flex` beats the parent's stylesheet rule, so the section keeps its
    // width and lines up next to other fixed-width sections
    style.flex = '0 0 auto'
    style.width = `${props.section.width}px`
    style.maxWidth = '100%'
  }
  return style
})

const orientation = computed(() => props.section.cardOrientation ?? 'auto')

/** Section alignment → justify-content of the cards container. */
const justify: Record<string, string> = { left: 'flex-start', center: 'center', right: 'flex-end' }

/**
 * Card flow: an explicit orientation wins over the grid the parent layout
 * passes in — 'auto' keeps the layout's own arrangement.
 */
const cardsStyle = computed(() => {
  const base: Record<string, string> = { ...(props.gridStyle ?? {}) }
  if (props.section.contentAlign) {
    base.justifyContent = justify[props.section.contentAlign]!
  }
  if (props.cardsPerRow) {
    return {
      ...base,
      display: 'grid',
      gridTemplateColumns: `repeat(${props.cardsPerRow}, minmax(0, 1fr))`,
    }
  }
  if (orientation.value === 'vertical') {
    return { ...base, display: 'grid', gridTemplateColumns: '1fr' }
  }
  if (orientation.value === 'horizontal') {
    return { ...base, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start' }
  }
  return base
})

/** Headings & co. claim the whole row — in a grid as well as in a flex row. */
function isFullRow(card: CardConfig): boolean {
  return cardRegistry[card.type]?.fullRow === true
}

function styleFor(card: CardConfig): Record<string, string> | undefined {
  // A full-row card keeps its width even where the layout sizes slots itself
  if (isFullRow(card)) return { gridColumn: '1 / -1', flexBasis: '100%', width: '100%' }
  if (props.slotStyle) return props.slotStyle(card)
  if (props.cardsPerRow) return undefined
  return card.size?.cols ? { gridColumn: `span ${card.size.cols}` } : undefined
}

/** Full-row cards have no size of their own, so they cannot be resized. */
function canResize(card: CardConfig): boolean {
  return props.resizable === true && props.editMode && !isFullRow(card)
}

/** The user's own CSS only — never mixed with the generated visibility rules. */
function userCssFor(card: CardConfig): string {
  return card.css ?? ''
}

/** Adds the visibility media-query rules, unless a card is being edited (always shown then). */
function cssFor(card: CardConfig): string {
  const base = userCssFor(card)
  if (props.editMode) return base
  const vis = visibilityMediaCss(card.visibility ?? cardDefaultVisibility(card.type))
  return vis ? `${base}${base.trim() ? '\n\n' : ''}${vis}` : base
}

// ── Resize (flex layout) ─────────────────────────────────────
// The native CSS resize handle sits in the bottom-right corner. While the
// pointer starts there we must suppress HTML5 drag & drop on the slot.
const resizing = ref(false)

function onSlotPointerDown(e: PointerEvent, card: CardConfig) {
  if (!canResize(card)) return
  const el = e.currentTarget as HTMLElement
  const r = el.getBoundingClientRect()
  resizing.value = e.clientX > r.right - 24 && e.clientY > r.bottom - 24
}

function onSlotPointerUp(e: PointerEvent, card: CardConfig) {
  if (!canResize(card) || !resizing.value) return
  resizing.value = false
  const el = e.currentTarget as HTMLElement
  const width = Math.round(el.offsetWidth)
  const height = Math.round(el.offsetHeight)
  if (width !== card.size?.width || height !== card.size?.height) {
    emit('resize-card', card.id, width, height)
  }
}
</script>

<template>
  <BaseEditableArea
    tag="section"
    class="layout-section"
    :editing="editMode"
    :dragging="sectionDragging"
    :drop-target="sectionDropTarget"
    :style="sectionStyle"
    @dragover="editMode && emit('dragover-section', $event, section)"
    @drop="editMode && emit('drop', $event)"
  >
    <template v-if="editMode" #toolbar>
      <BaseEditableAreaButton
        variant="drag"
        draggable="true"
        :title="t('editor.moveSection')"
        @dragstart="emit('section-dragstart', $event, section.id)"
      >
        <MdiIcon icon="mdi:drag-horizontal-variant" :size="18" />
      </BaseEditableAreaButton>
      <BaseEditableAreaButton :title="t('editor.section.title')" @click="emit('edit-section', section)">
        <MdiIcon icon="mdi:pencil" :size="16" />
      </BaseEditableAreaButton>
      <BaseEditableAreaButton :title="t('editor.duplicateSection')" @click="emit('duplicate-section', section)">
        <MdiIcon icon="mdi:plus-circle-multiple-outline" :size="16" />
      </BaseEditableAreaButton>
      <BaseEditableAreaButton :title="t('editor.copySection')" @click="emit('copy-section', section)">
        <MdiIcon icon="mdi:content-copy" :size="16" />
      </BaseEditableAreaButton>
      <BaseEditableAreaButton :title="t('editor.deleteSection')" @click="emit('remove-section', section)">
        <MdiIcon icon="mdi:delete-outline" :size="16" />
      </BaseEditableAreaButton>
    </template>

    <div class="cards-grid" :class="`orient-${orientation}`" :style="cardsStyle">
      <template v-for="(card, index) in section.cards" :key="card.id">
        <div
          class="card-slot"
          :class="{
            dragging: draggingId === card.id,
            'drop-before': dropTarget?.sectionId === section.id && dropTarget?.index === index,
            resizable: canResize(card),
          }"
          :style="styleFor(card)"
          :data-vp-card="cssFor(card) ? card.id : undefined"
          :draggable="editMode && !resizing"
          @pointerdown="onSlotPointerDown($event, card)"
          @pointerup="onSlotPointerUp($event, card)"
          @dragstart="emit('dragstart', $event, card.id)"
          @dragover="editMode && emit('dragover-card', $event, section.id, index)"
          @dragend="emit('dragend')"
        >
          <CardCss :card-id="card.id" :css="cssFor(card)" :content-css="userCssFor(card)">
            <component
              :is="resolveCardComponent(card.type)"
              v-if="resolveCardComponent(card.type)"
              :config="card.config"
              :area="area ?? 'dashboard'"
            />
            <div v-else class="unknown-card">{{ t('editor.unknownCard', { type: card.type }) }}</div>
          </CardCss>

          <BaseCardEditOverlay
            v-if="editMode"
            :reserve-resize-corner="canResize(card)"
            @edit="emit('edit-card', card)"
            @duplicate="emit('duplicate-card', card.id)"
            @copy="emit('copy-card', card)"
            @cut="emit('cut-card', card)"
            @delete="emit('remove-card', card.id)"
          />
        </div>
      </template>

      <BaseAddTile
        v-if="editMode"
        :label="t('editor.addCard')"
        @click="emit('pick', section.id)"
      />
    </div>
  </BaseEditableArea>
</template>

<style scoped>
/* Edit mode: the shared editable-area box gets extra room for the cards grid */
.layout-section.editing {
  padding: 16px;
  padding-top: 22px;
}
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}
/* Horizontal orientation: the grid becomes a flex row — give the cards a base width */
.cards-grid.orient-horizontal > * {
  flex: 1 1 160px;
  min-width: 0;
}
.card-slot {
  position: relative;
  /* Contain the edit overlay's z-index inside the card's own stacking
     context so it can never paint above unrelated elements. */
  isolation: isolate;
}
.card-slot.resizable {
  resize: both;
  overflow: hidden;
  min-width: 120px;
  min-height: 60px;
  outline: 1px dashed var(--divider);
  outline-offset: 2px;
  border-radius: var(--card-radius);
}
.card-slot.dragging {
  opacity: 0.4;
}
.card-slot.drop-before {
  outline: 2px dashed var(--accent);
  outline-offset: 4px;
  border-radius: var(--card-radius);
}
.unknown-card {
  border: 2px dashed var(--divider);
  border-radius: var(--card-radius);
  padding: 16px;
  color: var(--text-secondary);
}
</style>
