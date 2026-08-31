<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BarAlign, BarColumn, BarPosition, CardConfig } from '@/core/config/types'
import { useDashboardStore } from '@/core/config/dashboardStore'
import {
  barCardArea,
  cardDefaultVisibility,
  cardRegistry,
  resolveCardComponent,
  type CardCssArea,
} from '@/core/registry/cardRegistry'
import CardPicker from '@/core/editor/CardPicker.vue'
import CardConfigDialog from '@/core/editor/CardConfigDialog.vue'
import BaseAddTile from '@/core/ui/BaseAddTile.vue'
import BaseCardEditOverlay from '@/core/ui/BaseCardEditOverlay.vue'
import CardCss from '@/core/ui/CardCss.vue'
import { copyCardToClipboard } from '@/core/ui/cardClipboard'
import { visibilityMediaCss } from '@/core/ui/responsiveCss'

/**
 * The cards of one bar column. The column itself — spacing, alignment and
 * size — is laid out by ShellBarHost; this component only owns its cards.
 */
const props = defineProps<{
  bar: BarPosition
  column: BarColumn
  direction: 'column' | 'row'
  viewId?: string
}>()

const FLEX_ALIGN: Record<BarAlign, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
}

const { t } = useI18n()
const store = useDashboardStore()

const cards = computed<CardConfig[]>(() => props.column.cards)
const cssArea = computed<CardCssArea>(() => `bar_${barCardArea(props.bar)}`)

function userCssFor(card: CardConfig): string {
  return card.css ?? ''
}

function cssFor(card: CardConfig): string {
  const base = userCssFor(card)
  if (store.editMode) return base
  const vis = visibilityMediaCss(card.visibility ?? cardDefaultVisibility(card.type))
  return vis ? `${base}${base.trim() ? '\n\n' : ''}${vis}` : base
}

/**
 * The cards of a column live in their own scrolling track, separate from the
 * "+ Card" tile — that way the tile always stays reachable without having to
 * scroll past every card first (header/bottom scroll horizontally, sidebar
 * columns vertically). `justify-content` uses the CSS `safe` keyword
 * for anything but 'start': centering (or end-aligning) an overflowing flex
 * container without it makes the overflow on the leading side unreachable
 * by scrolling — a well known flexbox pitfall — so a scrolled bottom/header
 * bar would never show its first cards.
 */
function trackStyle(): Record<string, string> {
  const align = props.column.align ?? 'start'
  const cross = props.column.crossAlign ?? 'stretch'
  const justify = align === 'stretch' ? 'space-between' : FLEX_ALIGN[align]
  return {
    flexDirection: props.direction,
    justifyContent: align === 'start' || align === 'stretch' ? justify : `safe ${justify}`,
    alignItems: FLEX_ALIGN[cross],
    '--bar-card-cross': cross === 'stretch' ? '100%' : 'initial',
  }
}

/**
 * Bar cards size themselves: the manifest's `defaultSize` is meant for the
 * dashboard grid, not for a docked bar, so it is never applied here. Along
 * the bar axis a card simply takes its natural content size (fit-content)
 * and never shrinks below it (`flex-shrink: 0`) — it neither stretches to
 * fill the bar nor gets clamped to a fixed pixel box. Keeping the natural
 * size lets cards overflow their track instead of being squeezed, which is
 * what makes the track's own `overflow-x` (header/bottom only, see CSS
 * below) actually produce a scrollbar rather than silently shrinking every
 * card to fit. Across the bar axis a card falls back to its natural size
 * unless the column's crossAlign is 'stretch' (`--bar-card-cross: 100%`,
 * set by `trackStyle()` above).
 */
function styleFor(card: CardConfig): Record<string, string> {
  const defaults = cardRegistry[card.type]?.defaultSize
  const cross = props.direction === 'row'
    ? (card.size?.height ?? defaults?.height)
    : (card.size?.width ?? defaults?.width)
  const crossFallback = `${cross || 120}px`
  const style: Record<string, string> = { flex: '0 0 auto' }
  if (props.direction === 'row') {
    style.height = `var(--bar-card-cross, ${crossFallback})`
  } else {
    style.width = `var(--bar-card-cross, ${crossFallback})`
  }
  return style
}

const pickerOpen = ref(false)
const configTarget = ref<
  | { mode: 'new'; cardType: string }
  | {
      mode: 'edit'
      cardId: string
      cardType: string
      config: Record<string, unknown>
      css?: string
      visibility?: CardConfig['visibility']
    }
  | null
>(null)

function onPick(cardType: string, copiedCard?: Omit<CardConfig, 'id'>) {
  pickerOpen.value = false
  if (copiedCard) {
    store.addBarCard(props.bar, props.column.id, copiedCard, props.viewId)
    return
  }
  configTarget.value = { mode: 'new', cardType }
}

function onConfigSave(
  config: Record<string, unknown>,
  css?: string,
  _size?: CardConfig['size'],
  visibility?: CardConfig['visibility'],
) {
  const target = configTarget.value
  if (!target) return
  if (target.mode === 'new') {
    store.addBarCard(
      props.bar,
      props.column.id,
      { type: target.cardType, config, css, visibility },
      props.viewId,
    )
  } else {
    store.updateBarCardConfig(props.bar, props.column.id, target.cardId, config, css, visibility, props.viewId)
  }
  configTarget.value = null
}

function editCard(card: CardConfig) {
  configTarget.value = {
    mode: 'edit',
    cardId: card.id,
    cardType: card.type,
    config: card.config,
    css: card.css,
    visibility: card.visibility,
  }
}

function copyCard(card: CardConfig) {
  void copyCardToClipboard(card)
}

async function cutCard(card: CardConfig) {
  await copyCardToClipboard(card)
  store.removeBarCard(props.bar, props.column.id, card.id, props.viewId)
}

// ── Drag & drop (reorder inside a column, move between columns) ──
const dropIndex = ref<number | null>(null)

function onDragStart(event: DragEvent, cardId: string) {
  event.dataTransfer!.setData('text/plain', cardId)
  event.dataTransfer!.effectAllowed = 'move'
}

function onDragOver(event: DragEvent, index: number) {
  event.preventDefault()
  dropIndex.value = index
}

function onDrop(event: DragEvent) {
  event.preventDefault()
  const cardId = event.dataTransfer!.getData('text/plain')
  if (cardId) {
    store.moveBarCard(
      props.bar,
      cardId,
      props.column.id,
      dropIndex.value ?? cards.value.length,
      props.viewId,
    )
  }
  dropIndex.value = null
}
</script>

<template>
  <div class="bar-column-cards" :class="direction">
    <div
      class="bar-cards-track"
      :style="trackStyle()"
      @dragover.prevent="onDragOver($event, cards.length)"
      @drop="onDrop"
    >
      <div
        v-for="(card, index) in cards"
        :key="card.id"
        class="bar-card"
        :class="{ editing: store.editMode, 'drop-before': dropIndex === index }"
        :style="styleFor(card)"
        :data-vp-card="cssFor(card) ? card.id : undefined"
        :draggable="store.editMode"
        @dragstart="onDragStart($event, card.id)"
        @dragover="store.editMode && onDragOver($event, index)"
      >
        <CardCss :card-id="card.id" :css="cssFor(card)" :content-css="userCssFor(card)">
          <component
            :is="resolveCardComponent(card.type)"
            v-if="resolveCardComponent(card.type)"
            :config="card.config"
            :area="barCardArea(bar)"
          />
          <div v-else class="unknown-card">{{ t('editor.unknownCard', { type: card.type }) }}</div>
        </CardCss>

        <BaseCardEditOverlay
          v-if="store.editMode"
          @edit="editCard(card)"
          @duplicate="store.duplicateBarCard(bar, column.id, card.id, viewId)"
          @copy="copyCard(card)"
          @cut="cutCard(card)"
          @delete="store.removeBarCard(bar, column.id, card.id, viewId)"
        />
      </div>
    </div>

    <BaseAddTile
      v-if="store.editMode"
      class="bar-add-tile"
      variant="pill"
      orientation="horizontal"
      size="sm"
      :label="t('editor.addCard')"
      @click="pickerOpen = true"
    />

    <CardPicker
      v-if="pickerOpen"
      :area="barCardArea(bar)"
      @close="pickerOpen = false"
      @pick="onPick"
    />
    <CardConfigDialog
      v-if="configTarget"
      :card-type="configTarget.cardType"
      :initial-config="configTarget.mode === 'edit' ? configTarget.config : {}"
      :initial-css="configTarget.mode === 'edit' ? configTarget.css : undefined"
      :initial-visibility="configTarget.mode === 'edit' ? configTarget.visibility : undefined"
      :area="cssArea"
      @close="configTarget = null"
      @save="onConfigSave"
    />
  </div>
</template>

<style scoped>
/* Alignment stays with the column — the bar owns the slot geometry. */
.bar-column-cards {
  display: contents;
}
/*
 * The scrollable card list, separate from the "+ Card" tile below (a flex
 * sibling, flattened into ShellBarHost's `.bar-column-scroll` through this
 * component's own `display: contents`). When a column overflows, only this
 * track scrolls — horizontally in header/bottom ('row'), vertically in the
 * sidebars ('column') — so the tile always stays visible.
 */
.bar-cards-track {
  display: flex;
  flex: 1 1 auto;
  gap: 10px;
  min-width: 0;
  min-height: 0;
}
.row > .bar-cards-track {
  height: 100%;
  overflow-x: auto;
  overflow-y: hidden;
}
.column > .bar-cards-track {
  width: 100%;
  overflow-x: hidden;
  overflow-y: auto;
}
.bar-card {
  position: relative;
  /* Contain the edit overlay's z-index inside the card's own stacking
     context so it can never paint above unrelated elements. */
  isolation: isolate;
  min-width: 0;
  min-height: 0;
}
/* In edit mode the blur overlay covers the card, so anything scrolling under
   it would move invisibly — clamp the card to the size its track actually
   shows so the overlay has a fixed size. Scrolling itself is blocked by the
   overlay (see CardEditOverlay), which is why inner elements keep their own
   overflow. */
.bar-card.editing {
  max-width: 100%;
  max-height: 100%;
  overflow: hidden;
}
/* A card never grows past the bar it sits in. */
.row > .bar-cards-track > .bar-card {
  max-height: 100%;
}
.column > .bar-cards-track > .bar-card {
  max-width: 100%;
}
.bar-card.drop-before {
  outline: 2px dashed var(--accent);
  outline-offset: 3px;
  border-radius: var(--card-radius);
}
.bar-add-tile {
  flex: 0 0 auto;
}
.unknown-card {
  border: 2px dashed var(--divider);
  border-radius: var(--card-radius);
  padding: 12px;
  color: var(--text-secondary);
  font-size: 12px;
}
</style>
