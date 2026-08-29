<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BarPosition, SectionConfig, ViewAlign, ViewConfig, ViewLayout, ViewWidth } from '@/core/config/types'
import { newId, slugify, slugifyPath, useDashboardStore, viewPath } from '@/core/config/dashboardStore'
import BaseDialog from '@/core/ui/BaseDialog.vue'
import BaseButton from '@/core/ui/BaseButton.vue'
import { confirmDialog } from '@/core/ui/dialogService'
import BaseSelectMenu from '@/core/ui/BaseSelectMenu.vue'
import BaseInput from '@/core/ui/BaseInput.vue'
import BaseCheckbox from '@/core/ui/BaseCheckbox.vue'
import BaseTabs from '@/core/ui/BaseTabs.vue'
import BaseBoxInput from '@/core/ui/BaseBoxInput.vue'
import BaseCollapsible from '@/core/ui/BaseCollapsible.vue'
import { normalizeBox, type BoxValue } from '@/core/ui/boxInput'
import { mdiIconOptions } from '@/core/ui/mdiIconNames'

const props = defineProps<{
  /** Edit an existing view — or undefined to create a new one */
  view?: ViewConfig
  /** Use the supplied view as a template without changing it. */
  duplicate?: boolean
}>()
const emit = defineEmits<{ close: []; navigate: [viewId: string] }>()

const { t } = useI18n()
const store = useDashboardStore()

const editing = computed(() => Boolean(props.view && !props.duplicate))

function nextAvailablePath(base: string): string {
  const taken = new Set(store.config.views.map((view) => viewPath(view)))
  if (!taken.has(base)) return base
  let suffix = 2
  while (taken.has(`${base}-${suffix}`)) suffix++
  return `${base}-${suffix}`
}

const title = ref(
  props.duplicate && props.view
    ? t('editor.view.duplicateName', { title: props.view.title })
    : (props.view?.title ?? ''),
)
const icon = ref(props.view?.icon ?? 'mdi:view-dashboard')

// ── URL ──────────────────────────────────────────────────────
// Follows the title until the user edits it by hand.
const sourcePath = props.view
  ? (props.duplicate ? viewPath(props.view) : (props.view.path ?? slugify(props.view.title)))
  : ''
const path = ref(props.duplicate ? nextAvailablePath(sourcePath) : sourcePath)
const pathEdited = ref(props.duplicate || props.view?.path !== undefined)

watch(title, (value) => {
  if (!pathEdited.value) path.value = slugify(value)
})

function onPathInput(value: string) {
  pathEdited.value = true
  path.value = value
}

/** Sanitized and unique among the other views (their path or id). */
const finalPath = computed(() => slugifyPath(path.value) || slugify(title.value) || 'view')
const pathConflict = computed(() => {
  if (!path.value.trim() && !title.value.trim()) return false
  return store.config.views.some(
    (view) => viewPath(view) === finalPath.value && (!editing.value || view.id !== props.view?.id),
  )
})
const layout = ref<ViewLayout>(
  // 'tiles' is a legacy value — it was replaced by the flex layout
  (props.view?.layout as string) === 'tiles' ? 'flex' : (props.view?.layout ?? 'sections'),
)
const background = ref(props.view?.background ?? '')
const showSidebarLeft = ref(props.view?.showSidebarLeft !== false)
// A new view starts without the right sidebar
const showSidebarRight = ref(props.view?.showSidebarRight === true)
const showHeader = ref(props.view?.showHeader !== false)
const showBottom = ref(props.view?.showBottom !== false)

/**
 * A 'global' bar is switched on or off dashboard-wide from the dashboard
 * settings dialog — its own show/hide toggle here would be misleading, since
 * it would silently do nothing, so it is hidden entirely for that bar.
 */
function isPerView(position: BarPosition): boolean {
  return store.bars[position].scope === 'perView'
}
const gridColumns = ref(Number(props.view?.layoutOptions?.columns) || 4)
// Sections view specific options
const maxColumns = ref(Number(props.view?.layoutOptions?.maxColumns) || 4)
const denseSections = ref(props.view?.layoutOptions?.dense === true)
const topMargin = ref(props.view?.layoutOptions?.topMargin === true)

// Advanced tab
const padding = ref<BoxValue>({ ...props.view?.padding })
const margin = ref<BoxValue>({ ...props.view?.margin })
const width = ref<ViewWidth>(props.view?.width ?? 'default')
const align = ref<ViewAlign>(props.view?.align ?? 'center')

const layouts: ViewLayout[] = ['sections', 'flex', 'panel', 'sidebar', 'grid']

const tab = ref('general')
const tabItems = computed(() => [
  { value: 'general', label: t('editor.view.tabGeneral'), icon: 'mdi:tune' },
  { value: 'bars', label: t('editor.view.tabBars'), icon: 'mdi:dock-window' },
  { value: 'advanced', label: t('editor.view.tabAdvanced'), icon: 'mdi:page-layout-body' },
])

const iconOptions = computed(() => mdiIconOptions())
const layoutOptionList = computed(() =>
  layouts.map((l) => ({ value: l, label: t('editor.layouts.' + l) })),
)
const widthOptions = computed(() =>
  (['default', 'full'] as ViewWidth[]).map((w) => ({ value: w, label: t('editor.view.widths.' + w) })),
)
const alignOptions = computed(() =>
  (['left', 'center', 'right'] as ViewAlign[]).map((a) => ({
    value: a,
    label: t('editor.aligns.' + a),
  })),
)

function layoutOptionsFor(l: ViewLayout): Record<string, unknown> | undefined {
  if (l === 'grid') return { columns: Math.min(Math.max(gridColumns.value, 1), 12) }
  if (l === 'sections') {
    return {
      maxColumns: Math.min(Math.max(maxColumns.value, 1), 6),
      dense: denseSections.value,
      topMargin: topMargin.value,
    }
  }
  return undefined
}

function save() {
  if (!title.value.trim() || pathConflict.value) return
  const patch = {
    title: title.value.trim(),
    icon: icon.value.trim() || 'mdi:view-dashboard',
    path: finalPath.value,
    layout: layout.value,
    background: background.value.trim() || undefined,
    showSidebarLeft: showSidebarLeft.value,
    showSidebarRight: showSidebarRight.value,
    showHeader: showHeader.value,
    showBottom: showBottom.value,
    padding: normalizeBox(padding.value),
    margin: normalizeBox(margin.value),
    width: width.value === 'default' ? undefined : width.value,
    align: align.value === 'center' ? undefined : align.value,
    layoutOptions: layoutOptionsFor(layout.value),
  }
  if (editing.value && props.view) {
    store.updateView(props.view.id, patch)
    // The URL may have changed — follow it so the route stays valid
    emit('navigate', props.view.id)
  } else {
    const sections = props.duplicate && props.view
      ? duplicateSections(props.view.sections)
      : [{ id: newId('sec'), cards: [] }]
    const v = store.addView({
      ...patch,
      sections,
    })
    emit('navigate', v.id)
  }
  emit('close')
}

function duplicateSections(sections: SectionConfig[]): SectionConfig[] {
  const copy = JSON.parse(JSON.stringify(sections)) as SectionConfig[]
  return copy.map((section) => ({
    ...section,
    id: newId('sec'),
    cards: section.cards.map((card) => ({ ...card, id: newId('card') })),
  }))
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
  <BaseDialog
    :title="duplicate ? t('editor.view.duplicateTitle') : view ? t('editor.view.editTitle') : t('editor.view.newTitle')"
    @close="emit('close')"
  >
    <BaseTabs v-model="tab" :items="tabItems" class="dialog-tabs" />

    <div v-show="tab === 'general'" class="view-form">
      <div class="field">
        <span>{{ t('editor.view.title') }}</span>
        <BaseInput v-model="title" :placeholder="t('editor.view.titlePlaceholder')" />
      </div>
      <div class="field" :class="{ invalid: pathConflict }">
        <span>{{ t('editor.view.path') }}</span>
        <div class="path-row">
          <span class="path-prefix">#/</span>
          <BaseInput
            :model-value="path"
            :placeholder="t('editor.view.pathPlaceholder')"
            :spellcheck="false"
            :invalid="pathConflict"
            @update:model-value="onPathInput(String($event))"
          />
        </div>
        <small v-if="pathConflict" class="path-error">{{ t('editor.view.pathConflict') }}</small>
        <small v-else>{{ t('editor.view.pathHint') }}</small>
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
    </div>

    <div v-show="tab === 'bars'" class="view-form">
      <small>{{ t('editor.view.barsPerViewHint') }}</small>
      <div v-if="isPerView('sidebar-left')" class="row">
        <span>{{ t('editor.view.showSidebarLeft') }}</span>
        <BaseCheckbox v-model="showSidebarLeft" />
      </div>
      <div v-if="isPerView('sidebar-right')" class="row">
        <span>{{ t('editor.view.showSidebarRight') }}</span>
        <BaseCheckbox v-model="showSidebarRight" />
      </div>
      <div v-if="isPerView('header')" class="row">
        <span>{{ t('editor.view.showHeader') }}</span>
        <BaseCheckbox v-model="showHeader" />
      </div>
      <div v-if="isPerView('bottom')" class="row">
        <span>{{ t('editor.view.showBottom') }}</span>
        <BaseCheckbox v-model="showBottom" />
      </div>
    </div>

    <div v-show="tab === 'advanced'" class="view-form">
      <BaseCollapsible
        v-if="layout === 'sections'"
        :title="t('editor.view.sectionsSettings')"
        icon="mdi:view-dashboard-outline"
        default-open
      >
        <div class="field">
          <span>{{ t('editor.view.maxColumns') }}</span>
          <div class="slider-row">
            <input
              type="range"
              min="1"
              max="6"
              step="1"
              :value="maxColumns"
              @input="maxColumns = Number(($event.target as HTMLInputElement).value)"
            />
            <span class="slider-value">{{ maxColumns }}</span>
          </div>
        </div>
        <div class="row">
          <div class="row-text">
            <span>{{ t('editor.view.denseSections') }}</span>
            <small>{{ t('editor.view.denseSectionsHint') }}</small>
          </div>
          <BaseCheckbox v-model="denseSections" />
        </div>
        <div class="row">
          <div class="row-text">
            <span>{{ t('editor.view.topMargin') }}</span>
            <small>{{ t('editor.view.topMarginHint') }}</small>
          </div>
          <BaseCheckbox v-model="topMargin" />
        </div>
      </BaseCollapsible>

      <!-- Open when it is the first box, i.e. no sections box above it -->
      <BaseCollapsible
        :title="t('editor.view.spacing')"
        icon="mdi:page-layout-body"
        :default-open="layout !== 'sections'"
      >
        <BaseBoxInput v-model="margin" :label="t('editor.box.margin')" :min="-200" />
        <BaseBoxInput v-model="padding" :label="t('editor.box.padding')" />
        <div class="field">
          <span>{{ t('editor.view.width') }}</span>
          <BaseSelectMenu
            :model-value="width"
            :options="widthOptions"
            @update:model-value="width = $event as ViewWidth"
          />
          <small>{{ t('editor.view.widthHint') }}</small>
        </div>
        <div class="field">
          <span>{{ t('editor.view.align') }}</span>
          <BaseSelectMenu
            :model-value="align"
            :options="alignOptions"
            @update:model-value="align = $event as ViewAlign"
          />
          <small>{{ t('editor.view.alignHint') }}</small>
        </div>
      </BaseCollapsible>
    </div>
    <template #footer>
      <BaseButton v-if="editing" variant="danger" @click="remove">{{ t('common.delete') }}</BaseButton>
      <BaseButton @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton variant="primary" :disabled="!title.trim() || pathConflict" @click="save">
        {{ t('common.save') }}
      </BaseButton>
    </template>
  </BaseDialog>
</template>

<style scoped>
.dialog-tabs {
  margin-bottom: 18px;
}
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
.field > small {
  font-size: 12px;
  color: var(--text-secondary);
}
.field > small.path-error,
.field.invalid > span {
  color: var(--danger, #ef4444);
}
.path-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.path-row > :last-child {
  flex: 1;
  min-width: 0;
}
.path-prefix {
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
.row-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.row-text > span {
  font-size: 13px;
  color: var(--text-primary);
}
.row-text > small {
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
h3 {
  margin: 8px 0 0;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-secondary);
}
h3 + small {
  margin-top: -8px;
  font-size: 12px;
  color: var(--text-secondary);
}
</style>
