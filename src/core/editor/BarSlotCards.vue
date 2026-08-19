<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BarPosition, BarSlot, CardConfig } from '@/core/config/types'
import { useDashboardStore } from '@/core/config/dashboardStore'
import {
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
 * One slot of a global bar. The bar container itself is rendered by
 * ShellBarHost; this component only owns the cards inside a single slot
 * and their edit-mode affordances.
 */
const props = defineProps<{
  bar: BarPosition
  barSlot: BarSlot
  direction: 'column' | 'row'
}>()

const { t } = useI18n()
const store = useDashboardStore()

const cards = computed<CardConfig[]>(() => store.bars[props.bar].slots[props.barSlot])
const cssArea = computed<CardCssArea>(() => `bar_${props.bar}`)

function cssFor(card: CardConfig): string {
  return card.css ?? cardAreaCss(card.type, cssArea.value)
}

/**
 * Sandboxed cards render into an iframe and have no intrinsic size, so every
 * bar card is sized explicitly: along the bar axis from its own size, across
 * it from `--bar-card-cross` when the bar stretches its slot.
 */
function styleFor(card: CardConfig): Record<string, string> {
  const size = { ...cardRegistry[card.type]?.defaultSize, ...card.size }
  const width = `${size.width ?? 140}px`
  const height = `${size.height ?? 120}px`
  return props.direction === 'row'
    ? { width, height: `var(--bar-card-cross, ${height})` }
    : { height, width: `var(--bar-card-cross, ${width})` }
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
    store.addBarCard(props.bar, props.barSlot, copiedCard)
    return
  }
  configTarget.value = { mode: 'new', cardType }
}

function onConfigSave(config: Record<string, unknown>, css?: string) {
  const target = configTarget.value
  if (!target) return
  if (target.mode === 'new') {
    store.addBarCard(props.bar, props.barSlot, {
      type: target.cardType,
      config,
      css,
      size: cardRegistry[target.cardType]?.defaultSize,
    })
  } else {
    store.updateBarCardConfig(props.bar, props.barSlot, target.cardId, config, css)
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
  store.removeBarCard(props.bar, props.barSlot, card.id)
}

// ── Drag & drop (reorder inside a slot, move between slots) ──
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
  if (cardId) store.moveBarCard(props.bar, cardId, props.barSlot, dropIndex.value ?? cards.value.length)
  dropIndex.value = null
}
</script>

<template>
  <div
    v-if="cards.length > 0 || store.editMode"
    class="bar-slot-cards"
    :class="[direction, { editing: store.editMode }]"
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
        @duplicate="store.duplicateBarCard(bar, barSlot, card.id)"
        @copy="copyCard(card)"
        @cut="cutCard(card)"
        @delete="store.removeBarCard(bar, barSlot, card.id)"
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

    <CardPicker v-if="pickerOpen" :area="bar" @close="pickerOpen = false" @pick="onPick" />
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
.bar-slot-cards {
  display: flex;
  gap: 10px;
  min-width: 0;
  min-height: 0;
}
.bar-slot-cards.column {
  flex-direction: column;
}
/* Alignment stays with the bar container — it owns the slot geometry. */
.bar-slot-cards.row {
  flex-direction: row;
}
/* An empty slot still needs a target the add tile can sit in */
.bar-slot-cards.editing {
  min-height: 34px;
}
.bar-card {
  position: relative;
  flex: var(--bar-card-grow, 0) 0 auto;
  min-width: 0;
  min-height: 0;
}
/* A card never grows past the bar it sits in. */
.bar-slot-cards.row > .bar-card {
  max-height: 100%;
}
.bar-slot-cards.column > .bar-card {
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
