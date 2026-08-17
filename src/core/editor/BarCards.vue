<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BarPosition, BottomSlot, CardConfig, HeaderSlot, NavSlot } from '@/core/config/types'
import { useDashboardStore } from '@/core/config/dashboardStore'
import {
  cardAreaCss,
  cardRegistry,
  cssAreaOf,
  resolveCardComponent,
  type CardArea,
} from '@/core/registry/cardRegistry'
import CardPicker from '@/core/editor/CardPicker.vue'
import CardConfigDialog from '@/core/editor/CardConfigDialog.vue'
import BaseAddTile from '@/core/ui/BaseAddTile.vue'
import BaseCardEditOverlay from '@/core/ui/BaseCardEditOverlay.vue'
import CardCss from '@/core/ui/CardCss.vue'
import { copyCardToClipboard } from '@/core/ui/cardClipboard'

type BarSlot = NavSlot | HeaderSlot | BottomSlot

const props = defineProps<{
  bar: BarPosition
  barSlot: BarSlot
  direction: 'column' | 'row'
}>()

const { t } = useI18n()
const store = useDashboardStore()

const cards = computed<CardConfig[]>(() => {
  if (props.bar === 'sidebar') return store.nav.slots[props.barSlot as NavSlot]
  if (props.bar === 'header') return store.header.slots[props.barSlot as HeaderSlot]
  return store.bottom.slots[props.barSlot as BottomSlot]
})

const area = computed<CardArea>(() => `${props.bar}_${props.barSlot}` as CardArea)

function cssFor(card: CardConfig): string {
  return card.css ?? cardAreaCss(card.type, cssAreaOf(area.value))
}

const pickerOpen = ref(false)
const configTarget = ref<
  | { mode: 'new'; cardType: string }
  | { mode: 'edit'; cardId: string; cardType: string; config: Record<string, unknown>; css?: string }
  | null
>(null)

function addCard(card: Omit<CardConfig, 'id'>) {
  if (props.bar === 'sidebar') store.addNavCard(props.barSlot as NavSlot, card)
  else if (props.bar === 'header') store.addHeaderCard(props.barSlot as HeaderSlot, card)
  else store.addBottomCard(props.barSlot as BottomSlot, card)
}

function onPick(cardType: string, copiedCard?: Omit<CardConfig, 'id'>) {
  pickerOpen.value = false
  if (copiedCard) {
    addCard(copiedCard)
    return
  }
  configTarget.value = { mode: 'new', cardType }
}

function onConfigSave(config: Record<string, unknown>, css?: string) {
  const target = configTarget.value
  if (!target) return
  if (target.mode === 'new') {
    addCard({ type: target.cardType, config, css, size: cardRegistry[target.cardType]?.defaultSize })
  } else if (props.bar === 'sidebar') {
    store.updateNavCardConfig(props.barSlot as NavSlot, target.cardId, config, css)
  } else if (props.bar === 'header') {
    store.updateHeaderCardConfig(props.barSlot as HeaderSlot, target.cardId, config, css)
  } else {
    store.updateBottomCardConfig(props.barSlot as BottomSlot, target.cardId, config, css)
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

function removeCard(cardId: string) {
  if (props.bar === 'sidebar') store.removeNavCard(props.barSlot as NavSlot, cardId)
  else if (props.bar === 'header') store.removeHeaderCard(props.barSlot as HeaderSlot, cardId)
  else store.removeBottomCard(props.barSlot as BottomSlot, cardId)
}

function duplicateCard(cardId: string) {
  if (props.bar === 'sidebar') store.duplicateNavCard(props.barSlot as NavSlot, cardId)
  else if (props.bar === 'header') store.duplicateHeaderCard(props.barSlot as HeaderSlot, cardId)
  else store.duplicateBottomCard(props.barSlot as BottomSlot, cardId)
}

function copyCard(card: CardConfig) {
  void copyCardToClipboard(card)
}

async function cutCard(card: CardConfig) {
  await copyCardToClipboard(card)
  removeCard(card.id)
}

const draggingId = ref<string | null>(null)
const dropIndex = ref<number | null>(null)

function onDragStart(event: DragEvent, cardId: string) {
  draggingId.value = cardId
  event.dataTransfer!.setData('text/plain', cardId)
  event.dataTransfer!.effectAllowed = 'move'
}

function onDragOver(event: DragEvent, index: number) {
  event.preventDefault()
  dropIndex.value = index
}

function moveCard(cardId: string, index: number) {
  if (props.bar === 'sidebar') store.moveNavCard(cardId, props.barSlot as NavSlot, index)
  else if (props.bar === 'header') store.moveHeaderCard(cardId, props.barSlot as HeaderSlot, index)
  else store.moveBottomCard(cardId, props.barSlot as BottomSlot, index)
}

function onDrop(event: DragEvent) {
  event.preventDefault()
  const cardId = event.dataTransfer!.getData('text/plain')
  if (cardId && dropIndex.value !== null) moveCard(cardId, dropIndex.value)
  draggingId.value = null
  dropIndex.value = null
}

function onDragEnd() {
  draggingId.value = null
  dropIndex.value = null
}
</script>

<template>
  <div
    v-if="cards.length > 0 || store.editMode"
    class="bar-cards"
    :class="direction"
    @dragover.prevent="onDragOver($event, cards.length)"
    @drop="onDrop"
  >
    <div
      v-for="(card, index) in cards"
      :key="card.id"
      class="bar-card-slot"
      :class="{ dragging: draggingId === card.id, 'drop-before': dropIndex === index }"
      :data-vp-card="cssFor(card) ? card.id : undefined"
      :draggable="store.editMode"
      @dragstart="onDragStart($event, card.id)"
      @dragover="store.editMode && onDragOver($event, index)"
      @dragend="onDragEnd"
    >
      <CardCss v-if="cssFor(card)" :card-id="card.id" :css="cssFor(card)" />
      <component
        :is="resolveCardComponent(card.type)"
        v-if="resolveCardComponent(card.type)"
        :config="card.config"
      />
      <div v-else class="unknown-card">{{ t('editor.unknownCard', { type: card.type }) }}</div>

      <BaseCardEditOverlay
        v-if="store.editMode"
        @edit="editCard(card)"
        @duplicate="duplicateCard(card.id)"
        @copy="copyCard(card)"
        @cut="cutCard(card)"
        @delete="removeCard(card.id)"
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

    <CardPicker v-if="pickerOpen" :area="area" @close="pickerOpen = false" @pick="onPick" />
    <CardConfigDialog
      v-if="configTarget"
      :card-type="configTarget.cardType"
      :initial-config="configTarget.mode === 'edit' ? configTarget.config : {}"
      :initial-css="configTarget.mode === 'edit' ? configTarget.css : undefined"
      :area="cssAreaOf(area)"
      @close="configTarget = null"
      @save="onConfigSave"
    />
  </div>
</template>

<style scoped>
.bar-cards {
  display: flex;
  gap: 10px;
  min-width: 0;
}
.bar-cards.column {
  flex-direction: column;
}
.bar-cards.row {
  flex-direction: row;
  overflow-x: auto;
  padding: 8px;
}
.bar-cards.row .bar-card-slot {
  flex: 0 0 150px;
}
.bar-card-slot {
  position: relative;
  min-width: 0;
}
.bar-card-slot.dragging {
  opacity: 0.4;
}
.bar-card-slot.drop-before {
  outline: 2px dashed var(--accent);
  outline-offset: 3px;
  border-radius: var(--card-radius);
}
.unknown-card {
  border: 2px dashed var(--divider);
  border-radius: var(--card-radius);
  padding: 12px;
  font-size: 12px;
  color: var(--text-secondary);
}
.bar-cards.row :deep(.vp-add-tile) {
  flex: 0 0 auto;
}
</style>
