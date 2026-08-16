<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { cardRegistry } from '@/core/registry/cardRegistry'
import BaseDialog from '@/core/ui/BaseDialog.vue'
import MdiIcon from '@/core/ui/MdiIcon.vue'

const emit = defineEmits<{ close: []; pick: [type: string] }>()

const { t } = useI18n()
const cards = Object.values(cardRegistry)
</script>

<template>
  <BaseDialog :title="t('editor.cardPickerTitle')" @close="emit('close')">
    <div class="picker-grid">
      <button v-for="card in cards" :key="card.type" class="pick" @click="emit('pick', card.type)">
        <MdiIcon :icon="card.icon" :size="32" />
        <span>{{ t(card.name) }}</span>
      </button>
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
</style>
