<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { groupedCardsForArea, type CardArea } from '@/core/registry/cardRegistry'
import BaseDialog from '@/core/ui/BaseDialog.vue'
import MdiIcon from '@/core/ui/MdiIcon.vue'

const props = withDefaults(defineProps<{ area?: CardArea }>(), { area: 'dashboard' })
const emit = defineEmits<{ close: []; pick: [type: string] }>()

const { t, locale } = useI18n()

// Native group first, everything else alphabetically
const groups = computed(() => groupedCardsForArea(props.area, t, locale.value))
const isEmpty = computed(() => groups.value.length === 0)
</script>

<template>
  <BaseDialog :title="t('editor.cardPickerTitle')" size="lg" @close="emit('close')">
    <p v-if="isEmpty" class="no-cards">{{ t('editor.noCardsForArea') }}</p>

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
  </BaseDialog>
</template>

<style scoped>
.group + .group {
  margin-top: 22px;
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
.no-cards {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
}
</style>
