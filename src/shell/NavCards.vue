<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CardConfig, HeaderSlot, NavSlot } from '@/core/config/types'
import { useDashboardStore } from '@/core/config/dashboardStore'
import { cardRegistry, resolveCardComponent, type CardArea } from '@/core/registry/cardRegistry'
import CardPicker from '@/core/editor/CardPicker.vue'
import CardConfigDialog from '@/core/editor/CardConfigDialog.vue'
import MdiIcon from '@/core/ui/MdiIcon.vue'
import BaseAddTile from '@/core/ui/BaseAddTile.vue'
import CardCss from '@/core/ui/CardCss.vue'

/**
 * Cards of one bar slot — shared by SideNav (column), HeaderBar (row)
 * and BottomNav (row). Editing mirrors the layout sections: picker,
 * config dialog and drag & drop, against the slot of the given bar.
 */
const props = withDefaults(
  defineProps<{
    /** Which slot these cards belong to ('slot' is reserved in Vue) */
    navSlot: NavSlot | HeaderSlot
    /** Which bar the slot belongs to */
    bar?: 'sidebar' | 'header'
    /** Stack vertically (SideNav) or scroll horizontally (header/bottom) */
    direction: 'column' | 'row'
    /** Card types to leave out, e.g. the menu card in the BottomNav */
    hideTypes?: string[]
  }>(),
  { bar: 'sidebar' },
)

const { t } = useI18n()
const store = useDashboardStore()

/** The stored (unfiltered) cards of this slot. */
const slotCards = computed<CardConfig[]>(() =>
  props.bar === 'header'
    ? store.header.slots[props.navSlot as HeaderSlot]
    : store.nav.slots[props.navSlot as NavSlot],
)

const cards = computed(() => slotCards.value.filter((c) => !props.hideTypes?.includes(c.type)))
const area = computed<CardArea>(() => `${props.bar}_${props.navSlot}` as CardArea)

const pickerOpen = ref(false)
const configTarget = ref<
  | { mode: 'new'; cardType: string }
  | { mode: 'edit'; cardId: string; cardType: string; config: Record<string, unknown>; css?: string }
  | null
>(null)

function onPick(cardType: string) {
  pickerOpen.value = false
  configTarget.value = { mode: 'new', cardType }
}

function onConfigSave(config: Record<string, unknown>, css?: string) {
  const target = configTarget.value
  if (!target) return
  const card = {
    type: target.cardType,
    config,
    css,
    size: cardRegistry[target.cardType]?.defaultSize,
  }
  if (props.bar === 'header') {
    const slot = props.navSlot as HeaderSlot
    if (target.mode === 'new') store.addHeaderCard(slot, card)
    else store.updateHeaderCardConfig(slot, target.cardId, config, css)
  } else {
    const slot = props.navSlot as NavSlot
    if (target.mode === 'new') store.addNavCard(slot, card)
    else store.updateNavCardConfig(slot, target.cardId, config, css)
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
  if (props.bar === 'header') store.removeHeaderCard(props.navSlot as HeaderSlot, cardId)
  else store.removeNavCard(props.navSlot as NavSlot, cardId)
}

// ── Drag & Drop ──────────────────────────────────────────────
const draggingId = ref<string | null>(null)
const dropIndex = ref<number | null>(null)

function onDragStart(e: DragEvent, cardId: string) {
  draggingId.value = cardId
  e.dataTransfer!.setData('text/plain', cardId)
  e.dataTransfer!.effectAllowed = 'move'
}

function onDragOver(e: DragEvent, index: number) {
  e.preventDefault()
  dropIndex.value = index
}

/** Drop targets are indices into the filtered list — map back to the stored one. */
function rawIndex(index: number): number {
  const raw = slotCards.value
  if (!props.hideTypes?.length) return index
  const card = cards.value[index]
  return card ? raw.findIndex((c) => c.id === card.id) : raw.length
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  const cardId = e.dataTransfer!.getData('text/plain')
  if (cardId && dropIndex.value !== null) {
    const index = rawIndex(dropIndex.value)
    if (props.bar === 'header') store.moveHeaderCard(cardId, props.navSlot as HeaderSlot, index)
    else store.moveNavCard(cardId, props.navSlot as NavSlot, index)
  }
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
    class="nav-cards"
    :class="direction"
    @dragover.prevent="onDragOver($event, cards.length)"
    @drop="onDrop"
  >
    <div
      v-for="(card, index) in cards"
      :key="card.id"
      class="nav-card-slot"
      :class="{ dragging: draggingId === card.id, 'drop-before': dropIndex === index }"
      :data-vp-card="card.css ? card.id : undefined"
      :draggable="store.editMode"
      @dragstart="onDragStart($event, card.id)"
      @dragover="store.editMode && onDragOver($event, index)"
      @dragend="onDragEnd"
    >
      <CardCss v-if="card.css" :card-id="card.id" :css="card.css" />
      <component
        :is="resolveCardComponent(card.type)"
        v-if="resolveCardComponent(card.type)"
        :config="card.config"
      />
      <div v-else class="unknown-card">{{ t('editor.unknownCard', { type: card.type }) }}</div>

      <div v-if="store.editMode" class="card-edit-overlay">
        <button class="icon-btn" :title="t('editor.configure')" @click.stop="editCard(card)">
          <MdiIcon icon="mdi:cog" :size="16" />
        </button>
        <button
          class="icon-btn"
          :title="t('common.delete')"
          @click.stop="removeCard(card.id)"
        >
          <MdiIcon icon="mdi:delete-outline" :size="16" />
        </button>
      </div>
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
      @close="configTarget = null"
      @save="onConfigSave"
    />
  </div>
</template>

<style scoped>
.nav-cards {
  display: flex;
  gap: 10px;
}
.nav-cards.column {
  flex-direction: column;
}
.nav-cards.row {
  flex-direction: row;
  overflow-x: auto;
  padding: 8px;
}
.nav-cards.row .nav-card-slot {
  flex: 0 0 150px;
}
.nav-card-slot {
  position: relative;
  min-width: 0;
}
.nav-card-slot.dragging {
  opacity: 0.4;
}
.nav-card-slot.drop-before {
  outline: 2px dashed var(--accent);
  outline-offset: 3px;
  border-radius: var(--card-radius);
}
.card-edit-overlay {
  position: absolute;
  top: 4px;
  right: 4px;
  display: flex;
  gap: 2px;
  background: rgba(0, 0, 0, 0.55);
  border-radius: 8px;
  padding: 2px;
  z-index: 2;
}
.icon-btn {
  border: none;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  padding: 3px;
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
  padding: 12px;
  font-size: 12px;
  color: var(--text-secondary);
}
.nav-cards.row :deep(.vp-add-tile) {
  flex: 0 0 auto;
}
</style>
