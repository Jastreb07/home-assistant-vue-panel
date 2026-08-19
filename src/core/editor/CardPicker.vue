<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CardConfig, CustomCardDefinition } from '@/core/config/types'
import {
  cardDisplayName,
  cardRegistry,
  groupedCardsForArea,
  type CardArea,
  type CardManifest,
} from '@/core/registry/cardRegistry'
import { getPortableCard } from '@/core/ha'
import CustomCardDialog from '@/core/custom-cards/CustomCardDialog.vue'
import { editorDefinitionFromDocument } from '@/core/custom-cards/cardEditorModel'
import BaseDialog from '@/core/ui/BaseDialog.vue'
import MdiIcon from '@/core/ui/MdiIcon.vue'
import { readCardFromClipboard } from '@/core/ui/cardClipboard'
import { alertDialog } from '@/core/ui/dialogService'

const props = withDefaults(defineProps<{ area?: CardArea }>(), { area: 'dashboard' })
const emit = defineEmits<{
  close: []
  pick: [
    type: string,
    copiedCard?: Omit<CardConfig, 'id'>,
    initialConfig?: Record<string, unknown>,
  ]
}>()

const { t, locale } = useI18n()
const definitionTarget = ref<CustomCardDefinition | null>(null)

// Native group first, everything else alphabetically
const groups = computed(() => groupedCardsForArea(props.area, t, locale.value))
const clipboardCard = readCardFromClipboard()
const clipboardManifest = computed(() => {
  if (!clipboardCard) return null
  const manifest = cardRegistry[clipboardCard.type]
  return manifest && (manifest.areas ?? ['dashboard']).includes(props.area) ? manifest : null
})
const isEmpty = computed(() => groups.value.length === 0 && !clipboardManifest.value)

async function editPortableCard(manifest: CardManifest) {
  if (!manifest.portable) return
  try {
    definitionTarget.value = editorDefinitionFromDocument(await getPortableCard(manifest.type))
  } catch (error) {
    await alertDialog(String(error))
  }
}
</script>

<template>
  <BaseDialog :title="t('editor.cardPickerTitle')" size="lg" @close="emit('close')">
    <p v-if="isEmpty" class="no-cards">{{ t('editor.noCardsForArea') }}</p>

    <section v-if="clipboardManifest && clipboardCard" class="group clipboard-group">
      <h4 class="group-title">{{ t('editor.clipboard') }}</h4>
      <button
        class="pick clipboard-pick"
        @click="emit('pick', clipboardCard.type, clipboardCard)"
      >
        <span class="clipboard-icon">
          <MdiIcon icon="mdi:content-paste" :size="28" />
        </span>
        <span class="clipboard-copy">
          <strong>{{ t('editor.pasteCard') }}</strong>
          <small>{{ cardDisplayName(clipboardManifest, t) }}</small>
        </span>
      </button>
    </section>

    <section v-for="group in groups" :key="group.id" class="group">
      <h4 class="group-title">{{ group.literalLabel ? group.label : t(group.label) }}</h4>
      <div class="picker-grid">
        <div
          v-for="card in group.cards"
          :key="card.type"
          class="custom-pick-wrap"
        >
          <button class="pick custom-pick" @click="emit('pick', card.type)">
            <MdiIcon :icon="card.icon" :size="32" />
            <span>{{ cardDisplayName(card, t) }}</span>
            <small v-if="card.portable?.description">{{ card.portable.description }}</small>
          </button>
          <button
            v-if="card.portable"
            class="edit-definition"
            :title="t('editor.cardActions.edit')"
            @click="editPortableCard(card)"
          >
            <MdiIcon :icon="card.portable.writable ? 'mdi:pencil' : 'mdi:content-copy'" :size="14" />
          </button>
        </div>
      </div>
    </section>
  </BaseDialog>

  <CustomCardDialog
    v-if="definitionTarget"
    :definition="definitionTarget"
    @close="definitionTarget = null"
  />
</template>

<style scoped>
.group + .group {
  margin-top: 22px;
}
.clipboard-group {
  margin-bottom: 22px;
}
.group-title {
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-secondary);
}
.picker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 12px;
}
.pick {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 18px 8px;
  border: 1px solid var(--divider);
  border-radius: 12px;
  background: var(--card-bg);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.15s;
}
.pick:hover {
  border-color: var(--accent);
}
.custom-pick-wrap { position: relative; min-width: 0; }
.custom-pick { width: 100%; height: 100%; }
.custom-pick span,
.custom-pick small {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.custom-pick small { color: var(--text-secondary); font-size: 10px; }
.edit-definition {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border: 1px solid var(--divider);
  border-radius: 8px;
  background: var(--nav-bg);
  color: var(--text-secondary);
  cursor: pointer;
}
.edit-definition:hover { color: var(--accent); border-color: var(--accent); }
.clipboard-pick {
  width: 100%;
  flex-direction: row;
  justify-content: flex-start;
  padding: 13px 15px;
  border-color: color-mix(in srgb, var(--accent) 45%, var(--divider));
  text-align: left;
}
.clipboard-icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  border-radius: 11px;
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--accent);
}
.clipboard-copy {
  display: grid;
  gap: 3px;
}
.clipboard-copy strong {
  font-size: 14px;
}
.clipboard-copy small {
  color: var(--text-secondary);
  font-size: 12px;
}
.no-cards {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
}
</style>
