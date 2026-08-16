<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CardConfig } from '@/core/config/types'
import { useDashboardStore } from '@/core/config/dashboardStore'
import { cardRegistry, resolveCardComponent } from '@/core/registry/cardRegistry'
import CardPicker from '@/core/editor/CardPicker.vue'
import CardConfigDialog from '@/core/editor/CardConfigDialog.vue'
import MdiIcon from '@/core/ui/MdiIcon.vue'

/**
 * Cards inside the navigation — shared by SideNav (column) and
 * BottomNav (row). Editing mirrors the layout sections: picker,
 * config dialog and drag & drop, but against `store.nav.cards`.
 */
defineProps<{
  /** Stack vertically (SideNav) or scroll horizontally (BottomNav) */
  direction: 'column' | 'row'
}>()

const { t } = useI18n()
const store = useDashboardStore()

const pickerOpen = ref(false)
const configTarget = ref<
  | { mode: 'new'; cardType: string }
  | { mode: 'edit'; cardId: string; cardType: string; config: Record<string, unknown> }
  | null
>(null)

function onPick(cardType: string) {
  pickerOpen.value = false
  configTarget.value = { mode: 'new', cardType }
}

function onConfigSave(config: Record<string, unknown>) {
  const target = configTarget.value
  if (!target) return
  if (target.mode === 'new') {
    store.addNavCard({
      type: target.cardType,
      config,
      size: cardRegistry[target.cardType]?.defaultSize,
    })
  } else {
    store.updateNavCardConfig(target.cardId, config)
  }
  configTarget.value = null
}

function editCard(card: CardConfig) {
  configTarget.value = {
    mode: 'edit',
    cardId: card.id,
    cardType: card.type,
    config: card.config,
  }
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

function onDrop(e: DragEvent) {
  e.preventDefault()
  const cardId = e.dataTransfer!.getData('text/plain')
  if (cardId && dropIndex.value !== null) store.moveNavCard(cardId, dropIndex.value)
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
    v-if="store.nav.cards.length > 0 || store.editMode"
    class="nav-cards"
    :class="direction"
    @dragover.prevent="onDragOver($event, store.nav.cards.length)"
    @drop="onDrop"
  >
    <div
      v-for="(card, index) in store.nav.cards"
      :key="card.id"
      class="nav-card-slot"
      :class="{ dragging: draggingId === card.id, 'drop-before': dropIndex === index }"
      :draggable="store.editMode"
      @dragstart="onDragStart($event, card.id)"
      @dragover="store.editMode && onDragOver($event, index)"
      @dragend="onDragEnd"
    >
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
          @click.stop="store.removeNavCard(card.id)"
        >
          <MdiIcon icon="mdi:delete-outline" :size="16" />
        </button>
      </div>
    </div>

    <button v-if="store.editMode" class="add-nav-card" @click="pickerOpen = true">
      <MdiIcon icon="mdi:plus" :size="20" />
      <span>{{ t('editor.addCard') }}</span>
    </button>

    <CardPicker v-if="pickerOpen" area="nav" @close="pickerOpen = false" @pick="onPick" />
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
.add-nav-card {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  border: 2px dashed var(--divider);
  border-radius: 14px;
  background: transparent;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
}
.nav-cards.row .add-nav-card {
  flex: 0 0 auto;
}
.add-nav-card:hover {
  border-color: var(--accent);
  color: var(--accent);
}
</style>
