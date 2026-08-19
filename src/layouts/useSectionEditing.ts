import { ref, type Ref } from 'vue'
import type { CardConfig, SectionConfig, ViewConfig } from '@/core/config/types'
import { useDashboardStore } from '@/core/config/dashboardStore'
import { cardRegistry } from '@/core/registry/cardRegistry'
import { confirmDialog } from '@/core/ui/dialogService'
import { copyCardToClipboard } from '@/core/ui/cardClipboard'
import { t } from '@/i18n'

export type ConfigTarget =
  | {
      mode: 'new'
      sectionId: string
      cardType: string
      initialConfig?: Record<string, unknown>
    }
  | {
      mode: 'edit'
      cardId: string
      cardType: string
      config: Record<string, unknown>
      css?: string
      size?: CardConfig['size']
    }
  | null

/**
 * Shared editing logic for all section-based layouts:
 * card picker / config dialogs, section management and drag & drop.
 */
export function useSectionEditing(view: Ref<ViewConfig> | (() => ViewConfig)) {
  const getView = typeof view === 'function' ? view : () => view.value
  const store = useDashboardStore()

  // ── Dialog state ─────────────────────────────────────────────
  const pickerSectionId = ref<string | null>(null)
  const configTarget = ref<ConfigTarget>(null)

  function onPick(
    cardType: string,
    copiedCard?: Omit<CardConfig, 'id'>,
    initialConfig?: Record<string, unknown>,
  ) {
    const sectionId = pickerSectionId.value!
    pickerSectionId.value = null
    if (copiedCard) {
      store.addCard(getView().id, sectionId, copiedCard)
      return
    }
    configTarget.value = { mode: 'new', sectionId, cardType, initialConfig }
  }

  function onConfigSave(config: Record<string, unknown>, css?: string, size?: CardConfig['size']) {
    const target = configTarget.value
    if (!target) return
    if (target.mode === 'new') {
      store.addCard(getView().id, target.sectionId, {
        type: target.cardType,
        config,
        css,
        size: size ?? cardRegistry[target.cardType]?.defaultSize,
      })
    } else {
      store.updateCardConfig(getView().id, target.cardId, config, css)
      if (size) store.updateCardSize(getView().id, target.cardId, size)
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
      size: card.size,
    }
  }

  function removeCard(cardId: string) {
    store.removeCard(getView().id, cardId)
  }

  function duplicateCard(cardId: string) {
    store.duplicateCard(getView().id, cardId)
  }

  function copyCard(card: CardConfig) {
    void copyCardToClipboard(card)
  }

  async function cutCard(card: CardConfig) {
    await copyCardToClipboard(card)
    store.removeCard(getView().id, card.id)
  }

  /** Live card from the store — its size changes with every resize. */
  function cardById(cardId: string): CardConfig | undefined {
    for (const section of getView().sections) {
      const card = section.cards.find((c) => c.id === cardId)
      if (card) return card
    }
    return undefined
  }

  // ── Sections ─────────────────────────────────────────────────
  /** The section currently open in the SectionSettingsDialog. */
  const sectionTarget = ref<SectionConfig | null>(null)

  /** New sections are created right away and open their settings dialog. */
  function addSection() {
    const section = store.addSection(getView().id)
    if (section) sectionTarget.value = section
  }

  function editSection(section: SectionConfig) {
    sectionTarget.value = section
  }

  function onSectionSave(patch: Partial<Omit<SectionConfig, 'id' | 'cards'>>) {
    const section = sectionTarget.value
    if (!section) return
    store.updateSection(getView().id, section.id, patch)
  }

  async function removeSection(section: SectionConfig) {
    if (section.cards.length > 0 && !(await confirmDialog(t('editor.deleteSectionConfirm')))) return
    store.removeSection(getView().id, section.id)
  }

  /** Delete triggered inside the settings dialog — that one already confirmed. */
  function onSectionRemove() {
    const section = sectionTarget.value
    if (section) store.removeSection(getView().id, section.id)
  }

  // ── Drag & Drop (cards) ──────────────────────────────────────
  const draggingId = ref<string | null>(null)
  const dropTarget = ref<{ sectionId: string; index: number } | null>(null)

  // ── Drag & Drop (whole sections, via the ≡ handle) ───────────
  const draggingSectionId = ref<string | null>(null)
  const sectionDropId = ref<string | null>(null)

  function onDragStart(e: DragEvent, cardId: string) {
    draggingId.value = cardId
    e.dataTransfer!.setData('text/plain', cardId)
    e.dataTransfer!.effectAllowed = 'move'
  }

  function onSectionDragStart(e: DragEvent, sectionId: string) {
    draggingSectionId.value = sectionId
    e.dataTransfer!.setData('text/plain', `section:${sectionId}`)
    e.dataTransfer!.effectAllowed = 'move'
  }

  function onDragOverCard(e: DragEvent, sectionId: string, index: number) {
    e.preventDefault()
    if (draggingSectionId.value) {
      // While dragging a section, hovering its cards targets that section
      if (sectionId !== draggingSectionId.value) sectionDropId.value = sectionId
      return
    }
    dropTarget.value = { sectionId, index }
  }

  function onDragOverSection(e: DragEvent, section: SectionConfig) {
    e.preventDefault()
    if (draggingSectionId.value) {
      if (section.id !== draggingSectionId.value) sectionDropId.value = section.id
      return
    }
    if (dropTarget.value?.sectionId !== section.id) {
      dropTarget.value = { sectionId: section.id, index: section.cards.length }
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    if (draggingSectionId.value) {
      if (sectionDropId.value) {
        const toIndex = getView().sections.findIndex((s) => s.id === sectionDropId.value)
        store.moveSection(getView().id, draggingSectionId.value, toIndex)
      }
      draggingSectionId.value = null
      sectionDropId.value = null
      return
    }
    const cardId = e.dataTransfer!.getData('text/plain')
    if (cardId && dropTarget.value) {
      store.moveCard(getView().id, cardId, dropTarget.value.sectionId, dropTarget.value.index)
    }
    draggingId.value = null
    dropTarget.value = null
  }

  function onDragEnd() {
    draggingId.value = null
    dropTarget.value = null
    draggingSectionId.value = null
    sectionDropId.value = null
  }

  return {
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
    cardById,
    sectionTarget,
    addSection,
    editSection,
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
  }
}
