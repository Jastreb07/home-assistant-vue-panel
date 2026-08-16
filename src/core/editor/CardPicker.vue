<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { cardsForArea, type CardArea } from '@/core/registry/cardRegistry'
import BaseDialog from '@/core/ui/BaseDialog.vue'
import MdiIcon from '@/core/ui/MdiIcon.vue'

const props = withDefaults(defineProps<{ area?: CardArea }>(), { area: 'dashboard' })
const emit = defineEmits<{ close: []; pick: [type: string] }>()

const { t } = useI18n()
const cards = computed(() => cardsForArea(props.area))
</script>

<template>
  <BaseDialog :title="t('editor.cardPickerTitle')" @close="emit('close')">
    <div class="picker-grid">
      <button v-for="card in cards" :key="card.type" class="pick" @click="emit('pick', card.type)">
        <MdiIcon :icon="card.icon" :size="32" />
        <span>{{ t(card.name) }}</span>
      </button>
      <p v-if="cards.length === 0" class="no-cards">{{ t('editor.noCardsForArea') }}</p>
    </div>
  </BaseDialog>
</template>

<style scoped>
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
  cursor: pointer;
  transition: border-color 0.15s;
}
.pick:hover {
  border-color: var(--accent);
}
.no-cards {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
}
</style>
