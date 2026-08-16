<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ViewConfig, ViewLayout } from '@/core/config/types'
import { useDashboardStore } from '@/core/config/dashboardStore'
import BaseDialog from '@/core/ui/BaseDialog.vue'
import BaseButton from '@/core/ui/BaseButton.vue'
import { confirmDialog } from '@/core/ui/dialogService'
import BaseSelectMenu from '@/core/ui/BaseSelectMenu.vue'
import BaseInput from '@/core/ui/BaseInput.vue'
import BaseCheckbox from '@/core/ui/BaseCheckbox.vue'
import { mdiIconOptions } from '@/core/ui/mdiIconNames'

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
const background = ref(props.view?.background ?? '')
const showSidebar = ref(props.view?.showSidebar !== false)
const showHeader = ref(props.view?.showHeader === true)
const gridColumns = ref(Number(props.view?.layoutOptions?.columns) || 4)

const layouts: ViewLayout[] = ['sections', 'tiles', 'panel', 'sidebar', 'grid']

const iconOptions = computed(() => mdiIconOptions())
const layoutOptionList = computed(() =>
  layouts.map((l) => ({ value: l, label: t('editor.layouts.' + l) })),
)

function save() {
  if (!title.value.trim()) return
  const patch = {
    title: title.value.trim(),
    icon: icon.value.trim() || 'mdi:view-dashboard',
    layout: layout.value,
    background: background.value.trim() || undefined,
    showSidebar: showSidebar.value,
    showHeader: showHeader.value,
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
      <div class="field">
        <span>{{ t('editor.view.title') }}</span>
        <BaseInput v-model="title" :placeholder="t('editor.view.titlePlaceholder')" />
      </div>
      <div class="field">
        <span>{{ t('editor.view.icon') }}</span>
        <BaseSelectMenu
          v-model="icon"
          :options="iconOptions"
          searchable
          allow-custom
          custom-prefix="mdi:"
        />
      </div>
      <div class="field">
        <span>{{ t('editor.view.layout') }}</span>
        <BaseSelectMenu
          :model-value="layout"
          :options="layoutOptionList"
          @update:model-value="layout = $event as ViewLayout"
        />
      </div>
      <div v-if="layout === 'grid'" class="field">
        <span>{{ t('editor.view.gridColumns') }}</span>
        <BaseInput
          :model-value="gridColumns"
          type="number"
          :min="1"
          :max="12"
          @update:model-value="gridColumns = Number($event)"
        />
      </div>
      <div class="field">
        <span>{{ t('editor.view.background') }}</span>
        <BaseInput
          v-model="background"
          :placeholder="t('editor.view.backgroundPlaceholder')"
          :spellcheck="false"
        />
      </div>

      <h3>{{ t('editor.view.bars') }}</h3>
      <div class="row">
        <span>{{ t('editor.view.showSidebar') }}</span>
        <BaseCheckbox v-model="showSidebar" />
      </div>
      <div class="row">
        <span>{{ t('editor.view.showHeader') }}</span>
        <BaseCheckbox v-model="showHeader" />
      </div>
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
.row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.row > span {
  font-size: 13px;
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
