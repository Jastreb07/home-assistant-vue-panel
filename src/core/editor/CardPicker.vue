<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CardConfig, CustomCardDefinition } from '@/core/config/types'
import {
  cardDescription,
  cardDisplayName,
  cardRegistry,
  groupedCardsForArea,
  type CardArea,
  type CardManifest,
} from '@/core/registry/cardRegistry'
import { getPortableCard } from '@/core/ha'
import { useHassCustomCards } from '@/core/ha/hassCardBridge'
import {
  HASS_CARD_TYPE,
  hassCardAreas,
  hassCoreCards,
  newHassCardConfig,
  type HassCardType,
} from '@/core/registry/hassCards'
import CustomCardDialog from '@/core/custom-cards/CustomCardDialog.vue'
import { editorDefinitionFromDocument } from '@/core/custom-cards/cardEditorModel'
import BaseDialog from '@/core/ui/BaseDialog.vue'
import BaseInput from '@/core/ui/BaseInput.vue'
import BaseTabs from '@/core/ui/BaseTabs.vue'
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
const searchQuery = ref('')

// Native group first, everything else alphabetically
const availableGroups = computed(() => groupedCardsForArea(props.area, t, locale.value))
const groups = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase(locale.value)
  if (!query) return availableGroups.value

  return availableGroups.value.flatMap((group) => {
    const groupLabel = group.literalLabel ? group.label : t(group.label)
    const cards = group.cards.filter((card) => [
      cardDisplayName(card, t, locale.value),
      card.portable ? cardDescription(card, locale.value) : '',
      card.type,
      groupLabel,
    ].some((value) => value.toLocaleLowerCase(locale.value).includes(query)))
    return cards.length ? [{ ...group, cards }] : []
  })
})
// ── Home Assistant cards ─────────────────────────────────────
/** Only areas the overlay bridge can place a HA card in offer the tab. */
const hassSupported = computed(() => hassCardAreas.includes(props.area))
const customCards = useHassCustomCards()
const tab = ref<'vue' | 'hass'>('vue')
const tabItems = computed(() => [
  { value: 'vue', label: t('editor.hassCards.tabVuePanel'), icon: 'mdi:view-dashboard-outline' },
  { value: 'hass', label: t('editor.hassCards.tabHomeAssistant'), icon: 'mdi:home-assistant' },
])

/** Installed custom cards (HACS) shown next to the ones HA ships. */
const hassCustomCards = computed<HassCardType[]>(() =>
  customCards.value.map((card) => ({
    type: `custom:${card.type}`,
    name: card.name || card.type,
    icon: 'mdi:puzzle-outline',
  })),
)

function filterHassCards(cards: HassCardType[]): HassCardType[] {
  const query = searchQuery.value.trim().toLocaleLowerCase(locale.value)
  if (!query) return cards
  return cards.filter((card) =>
    [card.name, card.type].some((value) => value.toLocaleLowerCase(locale.value).includes(query)),
  )
}

const hassGroups = computed(() => [
  { id: 'core', label: t('editor.hassCards.coreGroup'), cards: filterHassCards(hassCoreCards) },
  { id: 'custom', label: t('editor.hassCards.customGroup'), cards: filterHassCards(hassCustomCards.value) },
].filter((group) => group.cards.length > 0))

const noHassResults = computed(() => hassGroups.value.length === 0)

function pickHassCard(card: HassCardType) {
  emit('pick', HASS_CARD_TYPE, undefined, newHassCardConfig(card.type))
}

const clipboardCard = readCardFromClipboard()
const clipboardManifest = computed(() => {
  if (!clipboardCard) return null
  const manifest = cardRegistry[clipboardCard.type]
  return manifest && (manifest.areas ?? ['dashboard']).includes(props.area) ? manifest : null
})
const isEmpty = computed(() => availableGroups.value.length === 0 && !clipboardManifest.value)
const noSearchResults = computed(() => Boolean(searchQuery.value.trim()) && groups.value.length === 0)

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
    <BaseTabs v-if="hassSupported" v-model="tab" :items="tabItems" class="picker-tabs" />

    <label class="picker-search">
      <span class="visually-hidden">{{ t('editor.searchCards') }}</span>
      <MdiIcon icon="mdi:magnify" :size="20" />
      <BaseInput
        v-model="searchQuery"
        :placeholder="t('editor.searchCards')"
        :spellcheck="false"
      />
      <button
        v-if="searchQuery"
        type="button"
        :aria-label="t('editor.clearCardSearch')"
        @click="searchQuery = ''"
      >
        <MdiIcon icon="mdi:close" :size="18" />
      </button>
    </label>

    <template v-if="hassSupported && tab === 'hass'">
      <p class="hass-hint">{{ t('editor.hassCards.hint') }}</p>
      <p v-if="noHassResults" class="no-cards">{{ t('editor.noCardsFound') }}</p>
      <section v-for="group in hassGroups" :key="group.id" class="group">
        <h4 class="group-title">{{ group.label }}</h4>
        <div class="picker-grid">
          <button
            v-for="card in group.cards"
            :key="card.type"
            class="pick custom-pick"
            @click="pickHassCard(card)"
          >
            <MdiIcon :icon="card.icon" :size="32" />
            <span>{{ card.name }}</span>
            <small>{{ card.type }}</small>
          </button>
        </div>
      </section>
    </template>

    <template v-else>
    <p v-if="isEmpty" class="no-cards">{{ t('editor.noCardsForArea') }}</p>
    <p v-else-if="noSearchResults" class="no-cards">{{ t('editor.noCardsFound') }}</p>

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
          <small>{{ cardDisplayName(clipboardManifest, t, locale) }}</small>
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
            <span>{{ cardDisplayName(card, t, locale) }}</span>
            <small v-if="card.portable?.description">{{ cardDescription(card, locale) }}</small>
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
    </template>
  </BaseDialog>

  <CustomCardDialog
    v-if="definitionTarget"
    :definition="definitionTarget"
    @close="definitionTarget = null"
  />
</template>

<style scoped>
.picker-tabs {
  margin-bottom: 18px;
}
.hass-hint {
  margin: 0 0 16px;
  color: var(--text-secondary);
  font-size: 12px;
}
.picker-search {
  position: relative;
  display: block;
  margin-bottom: 22px;
}
.picker-search > .mdi {
  position: absolute;
  top: 50%;
  left: 12px;
  z-index: 1;
  color: var(--text-secondary);
  pointer-events: none;
  transform: translateY(-50%);
}
.picker-search :deep(input.vp-input) {
  padding-right: 42px;
  padding-left: 40px;
}
.picker-search > button {
  position: absolute;
  top: 50%;
  right: 6px;
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transform: translateY(-50%);
}
.picker-search > button:hover {
  background: var(--nav-item-hover);
  color: var(--text-primary);
}
.picker-search > button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
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
