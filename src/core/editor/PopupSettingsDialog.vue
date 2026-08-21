<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PopupConfig, PopupSize, ViewAlign } from '@/core/config/types'
import { useDashboardStore } from '@/core/config/dashboardStore'
import BaseDialog from '@/core/ui/BaseDialog.vue'
import BaseButton from '@/core/ui/BaseButton.vue'
import BaseInput from '@/core/ui/BaseInput.vue'
import BaseSelectMenu from '@/core/ui/BaseSelectMenu.vue'
import BaseTabs from '@/core/ui/BaseTabs.vue'
import BaseBoxInput from '@/core/ui/BaseBoxInput.vue'
import BaseCollapsible from '@/core/ui/BaseCollapsible.vue'
import BaseCodeEditor from '@/core/ui/BaseCodeEditor.vue'
import { mdiIconOptions } from '@/core/ui/mdiIconNames'
import { normalizeBox, type BoxValue } from '@/core/ui/boxInput'
import { confirmDialog } from '@/core/ui/dialogService'

/** Settings of one custom popup: chrome, geometry, spacing and custom CSS. */
const props = defineProps<{ popup: PopupConfig }>()
const emit = defineEmits<{ close: []; remove: [] }>()

const { t } = useI18n()
const store = useDashboardStore()

const title = ref(props.popup.title)
const icon = ref(props.popup.icon ?? 'mdi:card-text-outline')
const size = ref<PopupSize>(props.popup.size ?? 'md')
const widthMode = ref<'preset' | 'custom'>(props.popup.width ? 'custom' : 'preset')
const width = ref(props.popup.width ?? 640)
const heightMode = ref<'auto' | 'custom'>(props.popup.height ? 'custom' : 'auto')
const height = ref(props.popup.height ?? 480)
const align = ref<ViewAlign>(props.popup.align ?? 'left')
const padding = ref<BoxValue>({ ...props.popup.padding })
const css = ref(props.popup.css ?? '')

const tab = ref('general')
const tabItems = computed(() => [
  { value: 'general', label: t('editor.popup.tabGeneral'), icon: 'mdi:tune' },
  { value: 'advanced', label: t('editor.popup.tabAdvanced'), icon: 'mdi:page-layout-body' },
  { value: 'css', label: t('editor.popup.tabCss'), icon: 'mdi:language-css3' },
])

const sizeOptions = computed(() =>
  (['sm', 'md', 'lg', 'full'] as PopupSize[]).map((value) => ({
    value,
    label: t(`editor.popup.sizes.${value}`),
  })),
)
const widthModeOptions = computed(() =>
  (['preset', 'custom'] as const).map((value) => ({
    value,
    label: t(`editor.popup.widthModes.${value}`),
  })),
)
const heightModeOptions = computed(() =>
  (['auto', 'custom'] as const).map((value) => ({
    value,
    label: t(`editor.popup.heightModes.${value}`),
  })),
)
const alignOptions = computed(() =>
  (['left', 'center', 'right'] as ViewAlign[]).map((value) => ({
    value,
    label: t(`editor.aligns.${value}`),
  })),
)
const iconOptions = mdiIconOptions()

function save() {
  store.updatePopup(props.popup.id, {
    title: title.value.trim() || t('editor.popup.untitled'),
    icon: icon.value,
    size: size.value,
    width: widthMode.value === 'custom' ? Math.round(width.value) : undefined,
    height: heightMode.value === 'custom' ? Math.round(height.value) : undefined,
    align: align.value,
    padding: normalizeBox(padding.value),
    css: css.value.trim() ? css.value : undefined,
  })
  emit('close')
}

async function remove() {
  if (!(await confirmDialog(t('editor.popup.deleteConfirm')))) return
  emit('remove')
  emit('close')
}
</script>

<template>
  <BaseDialog :title="t('editor.popup.settingsTitle')" size="lg" @close="emit('close')">
    <BaseTabs v-model="tab" :items="tabItems" />

    <div v-if="tab === 'general'" class="fields">
      <label class="field">
        <span>{{ t('editor.popup.title') }}</span>
        <BaseInput v-model="title" />
      </label>
      <label class="field">
        <span>{{ t('editor.popup.icon') }}</span>
        <BaseSelectMenu
          v-model="icon"
          :options="iconOptions"
          searchable
          allow-custom
          custom-prefix="mdi:"
        />
      </label>
      <label class="field">
        <span>{{ t('editor.popup.size') }}</span>
        <BaseSelectMenu
          :model-value="size"
          :options="sizeOptions"
          @update:model-value="size = $event as PopupSize"
        />
      </label>
    </div>

    <div v-else-if="tab === 'advanced'" class="fields">
      <BaseCollapsible :title="t('editor.popup.geometry')" icon="mdi:resize" default-open>
        <div class="fields">
          <label class="field">
            <span>{{ t('editor.popup.widthMode') }}</span>
            <BaseSelectMenu
              :model-value="widthMode"
              :options="widthModeOptions"
              @update:model-value="widthMode = $event as 'preset' | 'custom'"
            />
          </label>
          <label v-if="widthMode === 'custom'" class="field">
            <span>{{ t('editor.popup.width') }}</span>
            <BaseInput
              :model-value="width"
              type="number"
              :min="100"
              :max="4000"
              @update:model-value="width = Number($event)"
            />
          </label>
          <label class="field">
            <span>{{ t('editor.popup.heightMode') }}</span>
            <BaseSelectMenu
              :model-value="heightMode"
              :options="heightModeOptions"
              @update:model-value="heightMode = $event as 'auto' | 'custom'"
            />
          </label>
          <label v-if="heightMode === 'custom'" class="field">
            <span>{{ t('editor.popup.height') }}</span>
            <BaseInput
              :model-value="height"
              type="number"
              :min="100"
              :max="4000"
              @update:model-value="height = Number($event)"
            />
          </label>
        </div>
      </BaseCollapsible>

      <BaseCollapsible :title="t('editor.popup.spacing')" icon="mdi:arrow-expand-horizontal">
        <div class="fields">
          <label class="field">
            <span>{{ t('editor.view.align') }}</span>
            <BaseSelectMenu
              :model-value="align"
              :options="alignOptions"
              @update:model-value="align = $event as ViewAlign"
            />
          </label>
          <div class="field">
            <span>{{ t('editor.box.padding') }}</span>
            <BaseBoxInput v-model="padding" />
          </div>
        </div>
      </BaseCollapsible>
    </div>

    <div v-else class="fields">
      <BaseCodeEditor v-model="css" language="css" min-height="260px" />
    </div>

    <template #footer>
      <BaseButton variant="danger" @click="remove">{{ t('common.delete') }}</BaseButton>
      <BaseButton @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton variant="primary" @click="save">{{ t('common.save') }}</BaseButton>
    </template>
  </BaseDialog>
</template>

<style scoped>
.fields {
  display: grid;
  gap: 14px;
  margin-top: 16px;
}
.field {
  display: grid;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}
</style>
