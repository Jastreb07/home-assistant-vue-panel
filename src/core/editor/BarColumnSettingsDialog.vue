<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BarAlign, BarPosition, BarSizeMode } from '@/core/config/types'
import { barColumnSizeMode, isSidebar, useDashboardStore } from '@/core/config/dashboardStore'
import BaseDialog from '@/core/ui/BaseDialog.vue'
import BaseButton from '@/core/ui/BaseButton.vue'
import BaseInput from '@/core/ui/BaseInput.vue'
import BaseSelectMenu from '@/core/ui/BaseSelectMenu.vue'
import BaseBoxInput from '@/core/ui/BaseBoxInput.vue'
import { normalizeBox, type BoxValue } from '@/core/ui/boxInput'

/** Spacing, size and alignment of one bar column — the bar's counterpart to the view dialog. */
const props = defineProps<{ position: BarPosition; columnId: string; viewId?: string }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const store = useDashboardStore()

const column = computed(() =>
  store.barColumnsFor(props.position, props.viewId).find((c) => c.id === props.columnId),
)
const vertical = computed(() => isSidebar(props.position))

const sizeMode = ref<BarSizeMode>(column.value ? barColumnSizeMode(column.value) : 'fit')
const size = ref(column.value?.size ?? 0)
const padding = ref<BoxValue>({ ...column.value?.padding })
const margin = ref<BoxValue>({ ...column.value?.margin })
const align = ref<BarAlign>(column.value?.align ?? 'start')
const crossAlign = ref<BarAlign>(column.value?.crossAlign ?? 'stretch')

const alignments: BarAlign[] = ['start', 'center', 'end', 'stretch']
const sizeModes: BarSizeMode[] = ['fit', 'full', 'fixed']
const sizeModeOptions = computed(() =>
  sizeModes.map((mode) => ({ value: mode, label: t(`editor.barColumn.sizeModes.${mode}`) })),
)

/** Along the bar 'stretch' spreads the cards, across it they fill the column. */
function options(axis: 'along' | 'across') {
  const labels = vertical.value === (axis === 'along')
    ? { start: 'alignTop', center: 'alignMiddle', end: 'alignBottom' }
    : { start: 'alignLeft', center: 'alignCenter', end: 'alignRight' }
  return alignments.map((value) => ({
    value,
    label: t(`editor.nav.${value === 'stretch'
      ? (axis === 'along' ? 'alignSpread' : 'alignFull')
      : labels[value]}`),
  }))
}

function save() {
  store.updateBarColumn(
    props.position,
    props.columnId,
    {
      sizeMode: sizeMode.value,
      size: sizeMode.value === 'fixed' ? Math.max(1, Math.round(size.value) || 1) : undefined,
      padding: normalizeBox(padding.value),
      margin: normalizeBox(margin.value),
      align: align.value,
      crossAlign: crossAlign.value,
    },
    props.viewId,
  )
  emit('close')
}
</script>

<template>
  <BaseDialog :title="t('editor.barColumn.title')" @close="emit('close')">
    <div class="column-form">
      <div class="field">
        <span>{{ vertical ? t('editor.barColumn.height') : t('editor.barColumn.width') }}</span>
        <BaseSelectMenu
          :model-value="sizeMode"
          :options="sizeModeOptions"
          @update:model-value="sizeMode = $event as BarSizeMode"
        />
        <small>{{ t(`editor.barColumn.sizeModeHints.${sizeMode}`) }}</small>
      </div>
      <div v-if="sizeMode === 'fixed'" class="field">
        <span>{{ vertical ? t('editor.barColumn.height') : t('editor.barColumn.width') }} (px)</span>
        <BaseInput
          :model-value="size"
          type="number"
          :min="1"
          :max="1200"
          @update:model-value="size = Number($event)"
        />
      </div>

      <BaseBoxInput v-model="margin" :label="t('editor.box.margin')" :min="-200" />
      <BaseBoxInput v-model="padding" :label="t('editor.box.padding')" />

      <div class="field">
        <span>{{ t('editor.barColumn.align') }}</span>
        <BaseSelectMenu
          :model-value="align"
          :options="options('along')"
          @update:model-value="align = $event as BarAlign"
        />
      </div>
      <div class="field">
        <span>{{ t('editor.barColumn.crossAlign') }}</span>
        <BaseSelectMenu
          :model-value="crossAlign"
          :options="options('across')"
          @update:model-value="crossAlign = $event as BarAlign"
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
.column-form {
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
.field > small {
  font-size: 12px;
  color: var(--text-secondary);
}
</style>
