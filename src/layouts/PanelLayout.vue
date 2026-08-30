<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ViewConfig } from '@/core/config/types'
import { cardDefaultVisibility, resolveCardComponent } from '@/core/registry/cardRegistry'
import { visibilityMediaCss } from '@/core/ui/responsiveCss'
import CardPicker from '@/core/editor/CardPicker.vue'
import CardConfigDialog from '@/core/editor/CardConfigDialog.vue'
import BaseAddTile from '@/core/ui/BaseAddTile.vue'
import BaseCardEditOverlay from '@/core/ui/BaseCardEditOverlay.vue'
import CardCss from '@/core/ui/CardCss.vue'
import { useSectionEditing } from './useSectionEditing'

/**
 * Panel layout (like the HA "panel" view): a single card fills the
 * entire view. Only the first card of the first section is rendered.
 */
const props = defineProps<{ view: ViewConfig }>()

const {
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
} = useSectionEditing(() => props.view)

const { t } = useI18n()

const firstSection = computed(() => props.view.sections[0])
const panelCard = computed(() => firstSection.value?.cards[0])

/** The user's own CSS only — never mixed with the generated visibility rules. */
const panelUserCss = computed(() => panelCard.value?.css ?? '')

/** Adds the visibility media-query rules, unless the card is being edited. */
const panelCss = computed(() => {
  if (!panelCard.value) return ''
  const base = panelUserCss.value
  if (store.editMode) return base
  const vis = visibilityMediaCss(panelCard.value.visibility ?? cardDefaultVisibility(panelCard.value.type))
  return vis ? `${base}${base.trim() ? '\n\n' : ''}${vis}` : base
})
</script>

<template>
  <div class="panel-layout">
    <template v-if="panelCard">
      <div class="panel-slot" :data-vp-card="panelCss ? panelCard.id : undefined">
        <CardCss :card-id="panelCard.id" :css="panelCss" :content-css="panelUserCss">
          <component
            :is="resolveCardComponent(panelCard.type)"
            v-if="resolveCardComponent(panelCard.type)"
            :config="panelCard.config"
          />
          <div v-else class="unknown-card">{{ t('editor.unknownCard', { type: panelCard.type }) }}</div>
        </CardCss>

        <BaseCardEditOverlay
          v-if="store.editMode"
          @edit="editCard(panelCard)"
          @duplicate="duplicateCard(panelCard.id)"
          @copy="copyCard(panelCard)"
          @cut="cutCard(panelCard)"
          @delete="removeCard(panelCard.id)"
        />
      </div>
    </template>

    <BaseAddTile
      v-else-if="store.editMode && firstSection"
      size="lg"
      fill
      :label="t('editor.addCard')"
      @click="pickerSectionId = firstSection.id"
    />

    <div v-else class="empty">{{ t('editor.panelEmpty') }}</div>

    <CardPicker v-if="pickerSectionId" @close="pickerSectionId = null" @pick="onPick" />
    <CardConfigDialog
      v-if="configTarget"
      :card-type="configTarget.cardType"
      :initial-config="configTarget.mode === 'edit' ? configTarget.config : (configTarget.initialConfig ?? {})"
      :initial-css="configTarget.mode === 'edit' ? configTarget.css : undefined"
      :initial-visibility="configTarget.mode === 'edit' ? configTarget.visibility : undefined"
      @close="configTarget = null"
      @save="onConfigSave"
    />
  </div>
</template>

<style scoped>
.panel-layout {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.panel-slot {
  position: relative;
  /* Contain the edit overlay's z-index inside the card's own stacking
     context so it can never paint above unrelated elements. */
  isolation: isolate;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 60vh;
}
.panel-slot > :first-child {
  flex: 1;
}
.unknown-card {
  border: 2px dashed var(--divider);
  border-radius: var(--card-radius);
  padding: 16px;
  color: var(--text-secondary);
}
.empty {
  flex: 1;
  display: grid;
  place-items: center;
  color: var(--text-secondary);
}
</style>
