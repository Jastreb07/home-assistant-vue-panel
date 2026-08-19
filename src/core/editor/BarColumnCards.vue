<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BarColumn, BarPosition, CardConfig } from '@/core/config/types'
import { useDashboardStore } from '@/core/config/dashboardStore'
import {
  barCardArea,
  cardAreaCss,
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

/**
 * The cards of one bar column. The column itself — spacing, alignment and
 * size — is laid out by ShellBarHost; this component only owns its cards.
 */
const props = defineProps<{
  bar: BarPosition
  column: BarColumn
  direction: 'column' | 'row'
}>()

const { t } = useI18n()
const store = useDashboardStore()

const cards = computed<CardConfig[]>(() => props.column.cards)
const cssArea = computed<CardCssArea>(() => `bar_${barCardArea(props.bar)}`)

function cssFor(card: CardConfig): string {
  return card.css ?? cardAreaCss(card.type, cssArea.value)
}

/**
 * Sandboxed cards render into an iframe and have no intrinsic size, so every
 * bar card is sized explicitly: along the bar from its own size, across it
 * from `--bar-card-cross` when the column stretches its cards. A size of 0
 * along the bar lets the card fill whatever the other cards leave over.
 */
function styleFor(card: CardConfig): Record<string, string> {
  const size = { ...cardRegistry[card.type]?.defaultSize, ...card.size }
  const along = props.direction === 'row' ? size.width : size.height
  const fill = along === 0
  const style: Record<string, string> = { flex: fill ? '1 1 0' : '0 0 auto' }
  const width = `${size.width || 140}px`
  const height = `${size.height || 120}px`
  if (props.direction === 'row') {
    if (!fill) style.width = width
    style.height = `var(--bar-card-cross, ${height})`
  } else {
    if (!fill) style.height = height
    style.width = `var(--bar-card-cross, ${width})`
  }
  return style
}

const pickerOpen = ref(false)
const configTarget = ref<
  | { mode: 'new'; cardType: string }
  | { mode: 'edit'; cardId: string; cardType: string; config: Record<string, unknown>; css?: string }
  | null
>(null)

function onPick(cardType: string, copiedCard?: Omit<CardConfig, 'id'>) {
  pickerOpen.value = false
  if (copiedCard) {
    store.addBarCard(props.bar, props.column.id, copiedCard)
    return
  }
  configTarget.value = { mode: 'new', cardType }
}

function onConfigSave(config: Record<string, unknown>, css?: string) {
  const target = configTarget.value
  if (!target) return
  if (target.mode === 'new') {
    store.addBarCard(props.bar, props.column.id, {
      type: target.cardType,
      config,
      css,
      size: cardRegistry[target.cardType]?.defaultSize,
    })
  } else {
    store.updateBarCardConfig(props.bar, props.column.id, target.cardId, config, css)
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
  }
}

function copyCard(card: CardConfig) {
  void copyCardToClipboard(card)
}

async function cutCard(card: CardConfig) {
  await copyCardToClipboard(card)
  store.removeBarCard(props.bar, props.column.id, card.id)
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
    store.moveBarCard(props.bar, cardId, props.column.id, dropIndex.value ?? cards.value.length)
  }
  dropIndex.value = null
}
</script>

<template>
  <div
    class="bar-column-cards"
    :class="direction"
    @dragover.prevent="onDragOver($event, cards.length)"
    @drop="onDrop"
  >
    <div
      v-for="(card, index) in cards"
      :key="card.id"
      class="bar-card"
      :class="{ 'drop-before': dropIndex === index }"
      :style="styleFor(card)"
      :data-vp-card="cssFor(card) ? card.id : undefined"
      :draggable="store.editMode"
      @dragstart="onDragStart($event, card.id)"
      @dragover="store.editMode && onDragOver($event, index)"
    >
      <CardCss :card-id="card.id" :css="cssFor(card)">
        <component
          :is="resolveCardComponent(card.type)"
          v-if="resolveCardComponent(card.type)"
          :config="card.config"
        />
        <div v-else class="unknown-card">{{ t('editor.unknownCard', { type: card.type }) }}</div>
      </CardCss>

      <BaseCardEditOverlay
        v-if="store.editMode"
        @edit="editCard(card)"
        @duplicate="store.duplicateBarCard(bar, column.id, card.id)"
        @copy="copyCard(card)"
        @cut="cutCard(card)"
        @delete="store.removeBarCard(bar, column.id, card.id)"
      />
    </div>

    <BaseAddTile
      v-if="store.editMode"
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
.bar-card {
  position: relative;
  min-width: 0;
  min-height: 0;
}
/* A card never grows past the bar it sits in. */
.row > .bar-card {
  max-height: 100%;
}
.column > .bar-card {
  max-width: 100%;
}
.bar-card.drop-before {
  outline: 2px dashed var(--accent);
  outline-offset: 3px;
  border-radius: var(--card-radius);
}
.unknown-card {
  border: 2px dashed var(--divider);
  border-radius: var(--card-radius);
  padding: 12px;
  color: var(--text-secondary);
  font-size: 12px;
}
</style>
