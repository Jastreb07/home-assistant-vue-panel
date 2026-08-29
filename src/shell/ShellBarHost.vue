<script setup lang="ts">
import { computed, ref } from 'vue'
import type { BarAlign, BarColumn, BarPosition } from '@/core/config/types'
import { barColumnSizeMode, barSizeLimits, isSidebar, useDashboardStore } from '@/core/config/dashboardStore'
import { boxToCss } from '@/core/ui/boxInput'
import BarColumnCards from '@/core/editor/BarColumnCards.vue'
import BarColumnSettingsDialog from '@/core/editor/BarColumnSettingsDialog.vue'
import BaseAddTile from '@/core/ui/BaseAddTile.vue'
import BaseEditableArea from '@/core/ui/BaseEditableArea.vue'
import BaseEditableAreaButton from '@/core/ui/BaseEditableAreaButton.vue'
import CardCss from '@/core/ui/CardCss.vue'
import MdiIcon from '@/core/ui/MdiIcon.vue'
import { useI18n } from 'vue-i18n'

/**
 * A global bar: an engine component that lays out any number of columns.
 * Columns run along the bar — left to right in the header and bottom bars,
 * top to bottom in the sidebars — and each one holds its own cards.
 */
const props = defineProps<{ position: BarPosition; viewId?: string }>()

const FLEX_ALIGN: Record<BarAlign, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
}

const { t } = useI18n()
const store = useDashboardStore()
const bar = computed(() => store.bars[props.position])
/** The columns actually rendered — the view's own set when the bar is 'perView'. */
const columns = computed(() => store.barColumnsFor(props.position, props.viewId))
const vertical = computed(() => isSidebar(props.position))
const direction = computed<'column' | 'row'>(() => (vertical.value ? 'column' : 'row'))
const columnTarget = ref<string | null>(null)

/**
 * Extra room reserved above a horizontal bar in edit mode so the floating
 * column toolbar (anchored at `top: -40px` inside the bar) stays visible
 * instead of poking out of the bar — and, for the header, out of the
 * viewport. The bar grows by the same amount so the cards keep their space.
 */
const EDIT_TOOLBAR_SPACE = 45

const hostStyle = computed(() => {
  const limits = barSizeLimits[props.position]
  const size = Math.min(limits.max, Math.max(limits.min, Number(bar.value.size) || limits.min))
  if (vertical.value) return { width: `${size}px` }
  return store.editMode
    ? { height: `${size + EDIT_TOOLBAR_SPACE}px`, paddingTop: `${EDIT_TOOLBAR_SPACE}px` }
    : { height: `${size}px` }
})

/**
 * 'fit' shrinks to the column's cards but can also shrink below that when
 * the bar runs out of room — the column then scrolls its own overflow
 * internally (see BarColumnCards' `.bar-cards-track`) instead of
 * stretching the whole bar: horizontally in header/bottom, vertically in
 * the sidebars. 'full' shares the remaining space evenly with other 'full'
 * columns, 'fixed' uses the explicit size and never shrinks.
 */
function columnOuterStyle(column: BarColumn): Record<string, string> {
  const mode = barColumnSizeMode(column)
  const style: Record<string, string> = {
    flex: mode === 'full' ? '1 1 0' : mode === 'fixed' ? '0 0 auto' : '0 1 auto',
  }
  if (mode === 'fixed') style[vertical.value ? 'height' : 'width'] = `${column.size}px`
  const padding = boxToCss(column.padding)
  const margin = boxToCss(column.margin)
  if (padding) style.padding = padding
  if (margin) style.margin = margin
  return style
}

/**
 * The `.bar-column-scroll` wrapper only aligns the column's two flex
 * siblings — the cards' scrolling track and the "+ Card" tile — along the
 * cross axis and keeps them separate from the outer, non-scrolling
 * `BaseEditableArea` box (so its edit-mode toolbar isn't clipped by
 * `overflow`). Main-axis alignment, the `safe` overflow handling and the
 * scrolling itself belong to the cards only and live in
 * `BarColumnCards.vue`'s own `.bar-cards-track`.
 */
function columnScrollStyle(column: BarColumn): Record<string, string> {
  const cross = column.crossAlign ?? 'stretch'
  return {
    flexDirection: direction.value,
    alignItems: FLEX_ALIGN[cross],
  }
}
</script>

<template>
  <component
    :is="vertical ? 'nav' : position === 'header' ? 'header' : 'footer'"
    class="shell-bar-host"
    :class="[`shell-bar-host--${position}`, { 'is-editing': store.editMode }]"
    :data-vp-card="bar.css ? bar.id : undefined"
    :style="hostStyle"
  >
    <CardCss :card-id="bar.id" :css="bar.css ?? ''">
      <BaseEditableArea
        v-for="column in columns"
        :key="column.id"
        class="bar-column"
        :editing="store.editMode"
        :style="columnOuterStyle(column)"
      >
        <template v-if="store.editMode" #toolbar>
          <BaseEditableAreaButton
            :title="t('editor.barColumn.moveBack')"
            @click="store.moveBarColumn(position, column.id, -1, viewId)"
          >
            <MdiIcon :icon="vertical ? 'mdi:chevron-up' : 'mdi:chevron-left'" :size="15" />
          </BaseEditableAreaButton>
          <BaseEditableAreaButton
            :title="t('editor.barColumn.moveForward')"
            @click="store.moveBarColumn(position, column.id, 1, viewId)"
          >
            <MdiIcon :icon="vertical ? 'mdi:chevron-down' : 'mdi:chevron-right'" :size="15" />
          </BaseEditableAreaButton>
          <BaseEditableAreaButton :title="t('editor.barColumn.settings')" @click="columnTarget = column.id">
            <MdiIcon icon="mdi:cog" :size="15" />
          </BaseEditableAreaButton>
          <BaseEditableAreaButton
            v-if="columns.length > 1"
            :title="t('editor.barColumn.delete')"
            @click="store.removeBarColumn(position, column.id, viewId)"
          >
            <MdiIcon icon="mdi:delete-outline" :size="15" />
          </BaseEditableAreaButton>
        </template>
        <div class="bar-column-scroll" :style="columnScrollStyle(column)">
          <BarColumnCards :bar="position" :column="column" :direction="direction" :view-id="viewId" />
        </div>
      </BaseEditableArea>

      <BaseAddTile
        v-if="store.editMode"
        variant="pill"
        orientation="horizontal"
        size="sm"
        icon="mdi:table-column-plus-after"
        :label="t('editor.barColumn.add')"
        class="add-column"
        @click="store.addBarColumn(position, viewId)"
      />
    </CardCss>

    <BarColumnSettingsDialog
      v-if="columnTarget"
      :position="position"
      :column-id="columnTarget"
      :view-id="viewId"
      @close="columnTarget = null"
    />
  </component>
</template>

<style scoped>
.shell-bar-host {
  position: relative;
  flex-shrink: 0;
  min-width: 0;
  z-index: 2;
  box-sizing: border-box;
  display: flex;
  background: var(--nav-bg);
}
.shell-bar-host--sidebar-left,
.shell-bar-host--sidebar-right {
  height: 100%;
  flex-direction: column;
  gap: 20px;
  padding: 45px 16px;
  overflow: hidden;
}
/* Room for the column toolbars anchored at `top: -40px` between columns. */
.shell-bar-host--sidebar-left.is-editing,
.shell-bar-host--sidebar-right.is-editing {
  gap: 45px;
}
.shell-bar-host--sidebar-left {
  border-right: 1px solid var(--divider);
}
.shell-bar-host--sidebar-right {
  border-left: 1px solid var(--divider);
}
.shell-bar-host--header,
.shell-bar-host--bottom {
  width: 100%;
  align-items: stretch;
  gap: 16px;
  padding: 8px 16px;
}
.shell-bar-host--header {
  border-bottom: 1px solid var(--divider);
}
.shell-bar-host--bottom {
  border-top: 1px solid var(--divider);
}
/* The box/toolbar chrome comes from the shared editable-area theme component */
.bar-column {
  display: flex;
  min-width: 0;
  min-height: 0;
}
.bar-column.editing {
  min-width: 44px;
  min-height: 44px;
}
/*
 * The actual card layout lives in this inner wrapper, separate from the
 * outer editable-area box, so a column can scroll its own overflow without
 * clipping the edit-mode toolbar (which is positioned relative to the
 * outer box and would otherwise be cut off by `overflow`). It only aligns
 * its two children (the cards' track and the "+ Card" tile) across the
 * cross axis — scrolling itself happens one level deeper, in
 * BarColumnCards.vue's `.bar-cards-track`.
 */
.bar-column-scroll {
  display: flex;
  flex: 1 1 auto;
  gap: 10px;
  min-width: 0;
  min-height: 0;
}
/*
 * Relying only on `align-items: stretch` to pass the bar's height down
 * through column -> scroll wrapper -> cards track was not reliable once the
 * track became its own nested scroll container: without an explicit,
 * percentage-based height at each level the track fell back to its
 * unclipped content height (all cards at full natural width, stacked as if
 * not scrolling) and stretched the whole column open. Pinning the height
 * (header/bottom) or width (sidebars) to 100% here removes the ambiguity.
 */
.shell-bar-host--header .bar-column-scroll,
.shell-bar-host--bottom .bar-column-scroll {
  height: 100%;
}
.shell-bar-host--sidebar-left .bar-column-scroll,
.shell-bar-host--sidebar-right .bar-column-scroll {
  width: 100%;
}
.add-column {
  align-self: center;
  flex: none;
}
</style>
