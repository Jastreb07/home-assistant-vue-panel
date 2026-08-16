import { ref, type Ref } from 'vue'
import type { SectionConfig, ViewConfig } from '@/core/config/types'
import { useDashboardStore } from '@/core/config/dashboardStore'
import { cardRegistry } from '@/core/registry/cardRegistry'
import { confirmDialog, promptDialog } from '@/core/ui/dialogService'
import { t } from '@/i18n'

export type ConfigTarget =
  | { mode: 'new'; sectionId: string; cardType: string }
  | { mode: 'edit'; cardId: string; cardType: string; config: Record<string, unknown>; css?: string }
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

  function onPick(cardType: string) {
    const sectionId = pickerSectionId.value!
    pickerSectionId.value = null
    configTarget.value = { mode: 'new', sectionId, cardType }
  }

  function onConfigSave(config: Record<string, unknown>, css?: string) {
    const target = configTarget.value
    if (!target) return
    if (target.mode === 'new') {
      store.addCard(getView().id, target.sectionId, {
        type: target.cardType,
        config,
        css,
        size: cardRegistry[target.cardType]?.defaultSize,
      })
    } else {
      store.updateCardConfig(getView().id, target.cardId, config, css)
    }
    configTarget.value = null
  }

  function editCard(card: { id: string; type: string; config: Record<string, unknown>; css?: string }) {
    configTarget.value = {
      mode: 'edit',
      cardId: card.id,
      cardType: card.type,
      config: card.config,
      css: card.css,
    }
  }

  function removeCard(cardId: string) {
    store.removeCard(getView().id, cardId)
  }

  // ── Sections ─────────────────────────────────────────────────
  async function addSection() {
    const title = await promptDialog(t('editor.sectionTitlePrompt'), t('editor.newSectionDefault'))
    if (title !== null) store.addSection(getView().id, title || undefined)
  }

  async function renameSection(section: SectionConfig) {
    const title = await promptDialog(t('editor.sectionTitlePrompt'), section.title ?? '')
    if (title !== null) store.updateSection(getView().id, section.id, { title: title || undefined })
  }

  async function removeSection(section: SectionConfig) {
    if (section.cards.length > 0 && !(await confirmDialog(t('editor.deleteSectionConfirm')))) return
    store.removeSection(getView().id, section.id)
  }

  // ── Drag & Drop ──────────────────────────────────────────────
  const draggingId = ref<string | null>(null)
  const dropTarget = ref<{ sectionId: string; index: number } | null>(null)

  function onDragStart(e: DragEvent, cardId: string) {
    draggingId.value = cardId
    e.dataTransfer!.setData('text/plain', cardId)
    e.dataTransfer!.effectAllowed = 'move'
  }

  function onDragOverCard(e: DragEvent, sectionId: string, index: number) {
    e.preventDefault()
    dropTarget.value = { sectionId, index }
  }

  function onDragOverSection(e: DragEvent, section: SectionConfig) {
    e.preventDefault()
    if (dropTarget.value?.sectionId !== section.id) {
      dropTarget.value = { sectionId: section.id, index: section.cards.length }
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
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
  }

  return {
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
  }
}
