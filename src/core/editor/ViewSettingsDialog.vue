<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ViewConfig, ViewLayout } from '@/core/config/types'
import { useDashboardStore } from '@/core/config/dashboardStore'
import BaseDialog from '@/core/ui/BaseDialog.vue'
import BaseButton from '@/core/ui/BaseButton.vue'
import { confirmDialog } from '@/core/ui/dialogService'

const props = defineProps<{
  /** Edit an existing view — or undefined to create a new one */
  view?: ViewConfig
}>()
const emit = defineEmits<{ close: []; created: [viewId: string] }>()

const { t } = useI18n()
const store = useDashboardStore()

const title = ref(props.view?.title ?? '')
const icon = ref(props.view?.icon ?? 'mdi:view-dashboard')
const layout = ref<ViewLayout>(props.view?.layout ?? 'sections')
const subview = ref(props.view?.subview ?? false)
const background = ref(props.view?.background ?? '')
const gridColumns = ref(Number(props.view?.layoutOptions?.columns) || 4)

const layouts: ViewLayout[] = ['sections', 'tiles', 'panel', 'sidebar', 'grid']

function save() {
  if (!title.value.trim()) return
  const patch = {
    title: title.value.trim(),
    icon: icon.value.trim() || 'mdi:view-dashboard',
    layout: layout.value,
    subview: subview.value,
    background: background.value.trim() || undefined,
    layoutOptions:
      layout.value === 'grid' ? { columns: Math.min(Math.max(gridColumns.value, 1), 12) } : undefined,
  }
  if (props.view) {
    store.updateView(props.view.id, patch)
  } else {
    const v = store.addView({
      ...patch,
      sections: [{ id: 'sec-1', title: t('editor.view.newSectionTitle'), cards: [] }],
    })
    emit('created', v.id)
  }
  emit('close')
}

function remove() {
  if (!props.view) return
  const view = props.view
  confirmDialog(t('editor.view.deleteConfirm', { title: view.title })).then((ok) => {
    if (!ok) return
    store.removeView(view.id)
    emit('close')
  })
}
</script>

<template>
  <BaseDialog :title="view ? t('editor.view.editTitle') : t('editor.view.newTitle')" @close="emit('close')">
    <div class="view-form">
      <label>
        <span>{{ t('editor.view.title') }}</span>
        <input v-model="title" type="text" :placeholder="t('editor.view.titlePlaceholder')" />
      </label>
      <label>
        <span>{{ t('editor.view.icon') }}</span>
        <input v-model="icon" type="text" placeholder="mdi:sofa" spellcheck="false" />
      </label>
      <label>
        <span>{{ t('editor.view.layout') }}</span>
        <select v-model="layout">
          <option v-for="l in layouts" :key="l" :value="l">
            {{ t('editor.layouts.' + l) }}
          </option>
        </select>
      </label>
      <label v-if="layout === 'grid'">
        <span>{{ t('editor.view.gridColumns') }}</span>
        <input v-model.number="gridColumns" type="number" min="1" max="12" />
      </label>
      <label>
        <span>{{ t('editor.view.background') }}</span>
        <input v-model="background" type="text" :placeholder="t('editor.view.backgroundPlaceholder')" spellcheck="false" />
      </label>
      <label class="row">
        <span>{{ t('editor.view.subview') }}</span>
        <input v-model="subview" type="checkbox" />
      </label>
    </div>
    <template #footer>
      <BaseButton v-if="view" variant="danger" @click="remove">{{ t('common.delete') }}</BaseButton>
      <BaseButton @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton variant="primary" :disabled="!title.trim()" @click="save">
        {{ t('common.save') }}
      </BaseButton>
    </template>
  </BaseDialog>
</template>

<style scoped>
.view-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
label span {
  font-size: 13px;
  color: var(--text-secondary);
}
label.row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}
</style>
