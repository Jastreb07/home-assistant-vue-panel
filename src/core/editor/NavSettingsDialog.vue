<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { NavConfig } from '@/core/config/types'
import { useDashboardStore } from '@/core/config/dashboardStore'
import BaseDialog from '@/core/ui/BaseDialog.vue'
import BaseButton from '@/core/ui/BaseButton.vue'
import BaseSelectMenu from '@/core/ui/BaseSelectMenu.vue'

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const store = useDashboardStore()

const showClock = ref(store.nav.showClock)
const cardsPosition = ref<NavConfig['cardsPosition']>(store.nav.cardsPosition)
const width = ref(store.nav.width)

const positionOptions = computed(() => [
  { value: 'top', label: t('editor.nav.positionTop') },
  { value: 'bottom', label: t('editor.nav.positionBottom') },
])

function save() {
  store.updateNav({
    showClock: showClock.value,
    cardsPosition: cardsPosition.value,
    width: Math.min(Math.max(Number(width.value) || 280, 160), 560),
  })
  emit('close')
}
</script>

<template>
  <BaseDialog :title="t('editor.nav.title')" @close="emit('close')">
    <div class="nav-form">
      <p class="hint">{{ t('editor.nav.hint') }}</p>
      <label class="row">
        <span>{{ t('editor.nav.showClock') }}</span>
        <input v-model="showClock" type="checkbox" />
      </label>
      <div class="field">
        <span>{{ t('editor.nav.cardsPosition') }}</span>
        <BaseSelectMenu
          :model-value="cardsPosition"
          :options="positionOptions"
          @update:model-value="cardsPosition = $event as NavConfig['cardsPosition']"
        />
      </div>
      <label>
        <span>{{ t('editor.nav.width') }}</span>
        <input v-model.number="width" type="number" min="160" max="560" step="10" />
        <small>{{ t('editor.nav.widthHint') }}</small>
      </label>
    </div>
    <template #footer>
      <BaseButton @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton variant="primary" @click="save">{{ t('common.save') }}</BaseButton>
    </template>
  </BaseDialog>
</template>

<style scoped>
.nav-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
label,
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
label span,
.field > span {
  font-size: 13px;
  color: var(--text-secondary);
}
label.row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}
label small {
  font-size: 11px;
  color: var(--text-secondary);
  opacity: 0.8;
}
.hint {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
}
</style>
