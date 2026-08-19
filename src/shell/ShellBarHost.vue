<script setup lang="ts">
import { computed, ref } from 'vue'
import type { BarAlign, BarColumn, BarPosition } from '@/core/config/types'
import { barColumnSizeMode, barSizeLimits, isSidebar, useDashboardStore } from '@/core/config/dashboardStore'
import { boxToCss } from '@/core/ui/boxInput'
import BarColumnCards from '@/core/editor/BarColumnCards.vue'
import BarColumnSettingsDialog from '@/core/editor/BarColumnSettingsDialog.vue'
import BaseAddTile from '@/core/ui/BaseAddTile.vue'
import CardCss from '@/core/ui/CardCss.vue'
import MdiIcon from '@/core/ui/MdiIcon.vue'
import { useI18n } from 'vue-i18n'

/**
 * A global bar: an engine component that lays out any number of columns.
 * Columns run along the bar — left to right in the header and bottom bars,
 * top to bottom in the sidebars — and each one holds its own cards.
 */
const props = defineProps<{ position: BarPosition }>()

const FLEX_ALIGN: Record<BarAlign, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
}

const { t } = useI18n()
const store = useDashboardStore()
const bar = computed(() => store.bars[props.position])
const vertical = computed(() => isSidebar(props.position))
const direction = computed<'column' | 'row'>(() => (vertical.value ? 'column' : 'row'))
const columnTarget = ref<string | null>(null)

const hostStyle = computed(() => {
  const limits = barSizeLimits[props.position]
  const size = Math.min(limits.max, Math.max(limits.min, Number(bar.value.size) || limits.min))
  return vertical.value ? { width: `${size}px` } : { height: `${size}px` }
})

/**
 * 'fit' shrinks to the column's cards, 'full' shares the remaining space
 * evenly with other 'full' columns, 'fixed' uses the explicit size. Along
 * the bar the cards follow `align`, across it they follow `crossAlign` —
 * 'stretch' spreads or fills.
 */
function columnStyle(column: BarColumn): Record<string, string> {
  const align = column.align ?? 'start'
  const cross = column.crossAlign ?? 'stretch'
  const mode = barColumnSizeMode(column)
  const style: Record<string, string> = {
    flexDirection: direction.value,
    justifyContent: align === 'stretch' ? 'space-between' : FLEX_ALIGN[align],
    alignItems: FLEX_ALIGN[cross],
    '--bar-card-cross': cross === 'stretch' ? '100%' : 'initial',
    flex: mode === 'full' ? '1 1 0' : '0 0 auto',
  }
  if (mode === 'fixed') style[vertical.value ? 'height' : 'width'] = `${column.size}px`
  const padding = boxToCss(column.padding)
  const margin = boxToCss(column.margin)
  if (padding) style.padding = padding
  if (margin) style.margin = margin
  return style
}
</script>

<template>
  <component
    :is="vertical ? 'nav' : position === 'header' ? 'header' : 'footer'"
    class="shell-bar-host"
    :class="`shell-bar-host--${position}`"
    :data-vp-card="bar.css ? bar.id : undefined"
    :style="hostStyle"
  >
    <CardCss :card-id="bar.id" :css="bar.css ?? ''">
      <div
        v-for="column in bar.columns"
        :key="column.id"
        class="bar-column"
        :class="{ editing: store.editMode }"
        :style="columnStyle(column)"
      >
        <div v-if="store.editMode" class="column-toolbar">
          <button
            class="column-btn"
            :title="t('editor.barColumn.moveBack')"
            @click="store.moveBarColumn(position, column.id, -1)"
          >
            <MdiIcon :icon="vertical ? 'mdi:chevron-up' : 'mdi:chevron-left'" :size="15" />
          </button>
          <button
            class="column-btn"
            :title="t('editor.barColumn.moveForward')"
            @click="store.moveBarColumn(position, column.id, 1)"
          >
            <MdiIcon :icon="vertical ? 'mdi:chevron-down' : 'mdi:chevron-right'" :size="15" />
          </button>
          <button
            class="column-btn"
            :title="t('editor.barColumn.settings')"
            @click="columnTarget = column.id"
          >
            <MdiIcon icon="mdi:cog" :size="15" />
          </button>
          <button
            v-if="bar.columns.length > 1"
            class="column-btn"
            :title="t('editor.barColumn.delete')"
            @click="store.removeBarColumn(position, column.id)"
          >
            <MdiIcon icon="mdi:delete-outline" :size="15" />
          </button>
        </div>
        <BarColumnCards :bar="position" :column="column" :direction="direction" />
      </div>

      <BaseAddTile
        v-if="store.editMode"
        variant="pill"
        orientation="horizontal"
        size="sm"
        icon="mdi:table-column-plus-after"
        :label="t('editor.barColumn.add')"
        class="add-column"
        @click="store.addBarColumn(position)"
      />
    </CardCss>

    <BarColumnSettingsDialog
      v-if="columnTarget"
      :position="position"
      :column-id="columnTarget"
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
  gap: 24px;
  padding: 24px 16px;
  overflow: hidden auto;
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
  overflow: auto hidden;
}
.shell-bar-host--header {
  border-bottom: 1px solid var(--divider);
}
.shell-bar-host--bottom {
  border-top: 1px solid var(--divider);
}
.bar-column {
  position: relative;
  display: flex;
  gap: 10px;
  min-width: 0;
  min-height: 0;
}
.bar-column.editing {
  outline: 1px dashed color-mix(in srgb, var(--text-secondary) 35%, transparent);
  outline-offset: 2px;
  border-radius: 8px;
  min-width: 44px;
  min-height: 44px;
}
.column-toolbar {
  position: absolute;
  top: -12px;
  right: 4px;
  z-index: 6;
  display: flex;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--divider);
  border-radius: 8px;
  background: var(--card-bg);
}
.column-btn {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}
.column-btn:hover {
  color: var(--accent);
}
.add-column {
  align-self: center;
  flex: none;
}
</style>
