<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CardOrientation, SectionConfig, ViewAlign, ViewConfig } from '@/core/config/types'
import BaseDialog from '@/core/ui/BaseDialog.vue'
import BaseButton from '@/core/ui/BaseButton.vue'
import BaseInput from '@/core/ui/BaseInput.vue'
import BaseSelectMenu from '@/core/ui/BaseSelectMenu.vue'
import BaseTabs from '@/core/ui/BaseTabs.vue'
import BaseBoxInput from '@/core/ui/BaseBoxInput.vue'
import BaseCollapsible from '@/core/ui/BaseCollapsible.vue'
import { normalizeBox, type BoxValue } from '@/core/ui/boxInput'
import { confirmDialog } from '@/core/ui/dialogService'

/** Full editing dialog for one section — width, card orientation, spacing. */
const props = defineProps<{
  section: SectionConfig
  /** The owning view — decides the available width (sections layout) */
  view: ViewConfig
}>()
const emit = defineEmits<{
  close: []
  save: [patch: Partial<Omit<SectionConfig, 'id' | 'cards'>>]
  remove: []
}>()

const { t } = useI18n()

const orientation = ref<CardOrientation>(props.section.cardOrientation ?? 'auto')
const contentAlign = ref<ViewAlign>(props.section.contentAlign ?? 'left')
const padding = ref<BoxValue>({ ...props.section.padding })
const margin = ref<BoxValue>({ ...props.section.margin })

/** The width slider only makes sense where sections are laid out in columns. */
const isSectionsLayout = computed(() => props.view.layout === 'sections')
const maxColumns = computed(() => {
  const n = Number(props.view.layoutOptions?.maxColumns)
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 6) : 4
})
const columnSpan = ref(Math.min(props.section.columnSpan ?? 1, maxColumns.value))

/** In the flex layout a section is either full width or a fixed pixel width. */
const isFlexLayout = computed(() => props.view.layout === 'flex')
const widthMode = ref<'full' | 'custom'>(props.section.width ? 'custom' : 'full')
const customWidth = ref(props.section.width ?? 600)
const widthModeOptions = computed(() =>
  (['full', 'custom'] as const).map((w) => ({ value: w, label: t('editor.section.widths.' + w) })),
)
/** The size box is empty — and therefore hidden — in the other layouts. */
const hasSizeBox = computed(() => isSectionsLayout.value || isFlexLayout.value)

const tab = ref('general')
const tabItems = computed(() => [
  { value: 'general', label: t('editor.section.tabGeneral'), icon: 'mdi:tune' },
  { value: 'advanced', label: t('editor.section.tabAdvanced'), icon: 'mdi:page-layout-body' },
])

const orientationOptions = computed(() =>
  (['auto', 'vertical', 'horizontal'] as CardOrientation[]).map((o) => ({
    value: o,
    label: t('editor.section.orientations.' + o),
  })),
)

/** Both the flex layout and a horizontal section lay the cards out in a row. */
const isRow = computed(() => props.view.layout === 'flex' || orientation.value === 'horizontal')
const alignOptions = computed(() =>
  (['left', 'center', 'right'] as ViewAlign[]).map((a) => ({
    value: a,
    label: t('editor.aligns.' + a),
  })),
)

function save() {
  emit('save', {
    cardOrientation: orientation.value === 'auto' ? undefined : orientation.value,
    contentAlign: isRow.value && contentAlign.value !== 'left' ? contentAlign.value : undefined,
    columnSpan: isSectionsLayout.value && columnSpan.value > 1 ? columnSpan.value : undefined,
    width:
      isFlexLayout.value && widthMode.value === 'custom'
        ? Math.max(80, Math.round(Number(customWidth.value) || 0))
        : undefined,
    padding: normalizeBox(padding.value),
    margin: normalizeBox(margin.value),
  })
  emit('close')
}

async function remove() {
  if (props.section.cards.length > 0 && !(await confirmDialog(t('editor.deleteSectionConfirm')))) return
  emit('remove')
  emit('close')
}
</script>

<template>
  <BaseDialog :title="t('editor.section.title')" @close="emit('close')">
    <BaseTabs v-model="tab" :items="tabItems" class="dialog-tabs" />

    <div v-show="tab === 'general'" class="section-form">
      <div class="field">
        <span>{{ t('editor.section.orientation') }}</span>
        <BaseSelectMenu
          :model-value="orientation"
          :options="orientationOptions"
          @update:model-value="orientation = $event as CardOrientation"
        />
        <small>{{ t('editor.section.orientationHint') }}</small>
      </div>
      <div v-if="isRow" class="field">
        <span>{{ t('editor.section.contentAlign') }}</span>
        <BaseSelectMenu
          :model-value="contentAlign"
          :options="alignOptions"
          @update:model-value="contentAlign = $event as ViewAlign"
        />
        <small>{{ t('editor.section.contentAlignHint') }}</small>
      </div>
    </div>

    <div v-show="tab === 'advanced'" class="section-form">
      <BaseCollapsible
        v-if="hasSizeBox"
        :title="t('editor.section.size')"
        icon="mdi:arrow-expand-horizontal"
        default-open
      >
        <template v-if="isFlexLayout">
          <div class="field">
            <span>{{ t('editor.section.widthMode') }}</span>
            <BaseSelectMenu
              :model-value="widthMode"
              :options="widthModeOptions"
              @update:model-value="widthMode = $event as 'full' | 'custom'"
            />
          </div>
          <div v-if="widthMode === 'custom'" class="field">
            <span>{{ t('editor.section.customWidth') }}</span>
            <BaseInput
              :model-value="customWidth"
              type="number"
              :min="80"
              :max="4000"
              @update:model-value="customWidth = Number($event)"
            />
          </div>
        </template>

        <div v-if="isSectionsLayout" class="field">
          <span>{{ t('editor.section.width') }}</span>
          <div class="slider-row">
            <input
              type="range"
              min="1"
              :max="maxColumns"
              step="1"
              :value="columnSpan"
              @input="columnSpan = Number(($event.target as HTMLInputElement).value)"
            />
            <span class="slider-value">{{ columnSpan }}</span>
          </div>
          <small>{{ t('editor.section.widthHint') }}</small>
        </div>
      </BaseCollapsible>

      <!-- Open when it is the first box, i.e. outside the sections layout -->
      <BaseCollapsible
        :title="t('editor.section.spacing')"
        icon="mdi:page-layout-body"
        :default-open="!hasSizeBox"
      >
        <BaseBoxInput v-model="margin" :label="t('editor.box.margin')" :min="-200" />
        <BaseBoxInput v-model="padding" :label="t('editor.box.padding')" />
      </BaseCollapsible>
    </div>

    <template #footer>
      <BaseButton variant="danger" @click="remove">{{ t('common.delete') }}</BaseButton>
      <BaseButton @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton variant="primary" @click="save">{{ t('common.save') }}</BaseButton>
    </template>
  </BaseDialog>
</template>

<style scoped>
.dialog-tabs {
  margin-bottom: 18px;
}
.section-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
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
.slider-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.slider-row input[type='range'] {
  flex: 1;
  accent-color: var(--accent);
}
.slider-value {
  min-width: 40px;
  text-align: center;
  padding: 6px 8px;
  border: 1px solid var(--divider);
  border-radius: 8px;
  font-size: 14px;
  color: var(--text-primary);
}
</style>
