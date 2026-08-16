<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { NavAlign } from '@/core/config/types'
import { useDashboardStore } from '@/core/config/dashboardStore'
import BaseDialog from '@/core/ui/BaseDialog.vue'
import BaseButton from '@/core/ui/BaseButton.vue'
import BaseSelectMenu from '@/core/ui/BaseSelectMenu.vue'
import BaseInput from '@/core/ui/BaseInput.vue'

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const store = useDashboardStore()

const height = ref(store.header.height)
const vertical = ref<NavAlign>(store.header.centerAlign.vertical)
const horizontal = ref<NavAlign>(store.header.centerAlign.horizontal)

const verticalOptions = computed(() => [
  { value: 'start', label: t('editor.nav.alignTop') },
  { value: 'center', label: t('editor.nav.alignMiddle') },
  { value: 'end', label: t('editor.nav.alignBottom') },
  { value: 'stretch', label: t('editor.nav.alignFull') },
])

const horizontalOptions = computed(() => [
  { value: 'start', label: t('editor.nav.alignLeft') },
  { value: 'center', label: t('editor.nav.alignCenter') },
  { value: 'end', label: t('editor.nav.alignRight') },
  { value: 'stretch', label: t('editor.nav.alignSpread') },
])

function save() {
  store.updateHeader({
    height: Math.min(Math.max(Number(height.value) || 64, 40), 240),
    centerAlign: { vertical: vertical.value, horizontal: horizontal.value },
  })
  emit('close')
}
</script>

<template>
  <BaseDialog :title="t('editor.header.title')" @close="emit('close')">
    <div class="header-form">
      <p class="hint">{{ t('editor.header.hint') }}</p>
      <div class="field">
        <span>{{ t('editor.header.height') }}</span>
        <BaseInput
          :model-value="height"
          type="number"
          :min="40"
          :max="240"
          :step="4"
          @update:model-value="height = Number($event)"
        />
        <small>{{ t('editor.header.heightHint') }}</small>
      </div>

      <h3>{{ t('editor.nav.centerAlign') }}</h3>
      <div class="field">
        <span>{{ t('editor.nav.horizontal') }}</span>
        <BaseSelectMenu
          :model-value="horizontal"
          :options="horizontalOptions"
          @update:model-value="horizontal = $event as NavAlign"
        />
      </div>
      <div class="field">
        <span>{{ t('editor.nav.vertical') }}</span>
        <BaseSelectMenu
          :model-value="vertical"
          :options="verticalOptions"
          @update:model-value="vertical = $event as NavAlign"
        />
      </div>
    </div>
    <template #footer>
      <BaseButton @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton variant="primary" @click="save">{{ t('common.save') }}</BaseButton>
    </template>
  </BaseDialog>
</template>

<style scoped>
.header-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field > span {
  font-size: 13px;
  color: var(--text-secondary);
}
.field small {
  font-size: 11px;
  color: var(--text-secondary);
  opacity: 0.8;
}
.hint {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
}
h3 {
  margin: 8px 0 0;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-secondary);
}
</style>
