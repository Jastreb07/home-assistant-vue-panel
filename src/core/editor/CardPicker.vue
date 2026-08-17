<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CardConfig, CustomCardDefinition } from '@/core/config/types'
import { useDashboardStore } from '@/core/config/dashboardStore'
import { cardRegistry, groupedCardsForArea, type CardArea } from '@/core/registry/cardRegistry'
import CustomCardDialog from '@/core/custom-cards/CustomCardDialog.vue'
import BaseDialog from '@/core/ui/BaseDialog.vue'
import MdiIcon from '@/core/ui/MdiIcon.vue'
import { readCardFromClipboard } from '@/core/ui/cardClipboard'

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
const store = useDashboardStore()
const definitionTarget = ref<CustomCardDefinition | null>(null)

// Native group first, everything else alphabetically
const groups = computed(() => groupedCardsForArea(props.area, t, locale.value))
const clipboardCard = readCardFromClipboard()
const clipboardManifest = computed(() => {
  if (!clipboardCard) return null
  const manifest = cardRegistry[clipboardCard.type]
  if (clipboardCard.type === 'custom-html') {
    return props.area === 'dashboard'
      && store.customCardById(String(clipboardCard.config.definitionId ?? ''))
      ? manifest
      : null
  }
  return manifest && (manifest.areas ?? ['dashboard']).includes(props.area) ? manifest : null
})
const customCards = computed(() => props.area === 'dashboard' ? store.customCards : [])
const isEmpty = computed(() => groups.value.length === 0 && customCards.value.length === 0 && !clipboardManifest.value)

function addCustomCard(definition: CustomCardDefinition) {
  if (definition.variables.length > 0) {
    emit('pick', 'custom-html', undefined, { definitionId: definition.id })
    return
  }
  emit('pick', 'custom-html', {
    type: 'custom-html',
    config: { definitionId: definition.id },
    size: { ...definition.defaultSize },
  })
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
          <small>{{ t(clipboardManifest.name) }}</small>
        </span>
      </button>
    </section>

    <section v-for="group in groups" :key="group.id" class="group">
      <h4 class="group-title">{{ t(group.label) }}</h4>
      <div class="picker-grid">
        <button
          v-for="card in group.cards"
          :key="card.type"
          class="pick"
          @click="emit('pick', card.type)"
        >
          <MdiIcon :icon="card.icon" :size="32" />
          <span>{{ t(card.name) }}</span>
        </button>
      </div>
    </section>

    <section v-if="customCards.length" class="group">
      <h4 class="group-title">{{ t('cards.groups.custom') }}</h4>
      <div class="picker-grid">
        <div v-for="definition in customCards" :key="definition.id" class="custom-pick-wrap">
          <button class="pick custom-pick" @click="addCustomCard(definition)">
            <MdiIcon :icon="definition.icon" :size="32" />
            <span>{{ definition.name }}</span>
            <small v-if="definition.description">{{ definition.description }}</small>
          </button>
          <button
            class="edit-definition"
            :title="t('editor.cardActions.edit')"
            @click="definitionTarget = definition"
          >
            <MdiIcon icon="mdi:pencil" :size="14" />
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
