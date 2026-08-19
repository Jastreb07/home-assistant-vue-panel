<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MdiIcon from '@/core/ui/MdiIcon.vue'
import {
  isParentView,
  viewDepth,
  type ViewMoveDirection,
  type ViewSelectOption,
} from '@/core/ui/viewSelect'
import type { ControlSize } from '@/core/ui/controlSize'

/**
 * Dropdown specialised on dashboard views: it shows the hierarchy, marks the
 * default view (the first one) with a star and reorders views in place through
 * the arrow buttons on the right of every row.
 */

const ICON_SIZE: Record<ControlSize, number> = { xs: 14, sm: 16, md: 22, lg: 24, xl: 26 }

const props = withDefaults(
  defineProps<{
    /** Id of the active view */
    modelValue: string
    /** Views in their stored order — index 0 is the default view */
    views: ViewSelectOption[]
    /** Field size — shares the scale with Button and Input */
    size?: ControlSize
    /** Show a search field — helpful for long view lists */
    searchable?: boolean
    /** Offer the reorder arrows */
    reorderable?: boolean
  }>(),
  { size: 'md', reorderable: true },
)

const emit = defineEmits<{
  'update:modelValue': [viewId: string]
  move: [viewId: string, direction: ViewMoveDirection]
}>()

const iconSize = computed(() => ICON_SIZE[props.size])

const root = ref<HTMLElement | null>(null)
const listEl = ref<HTMLElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)
const open = ref(false)
const query = ref('')
const activeIndex = ref(0)

const selected = computed(() => props.views.find((v) => v.id === props.modelValue))
const defaultViewId = computed(() => props.views[0]?.id ?? '')

/** Reordering only makes sense while the full, unfiltered list is visible. */
const filtering = computed(() => props.searchable === true && query.value.trim().length > 0)
const showMoveButtons = computed(() => props.reorderable && !filtering.value)

interface ViewRow extends ViewSelectOption {
  /** Position in the stored list — the reorder buttons work on it */
  index: number
  depth: number
  parent: boolean
  child: boolean
  isDefault: boolean
}

const rows = computed<ViewRow[]>(() => {
  const all = props.views
  const q = query.value.trim().toLowerCase()
  return all
    .map((view, index) => ({
      ...view,
      index,
      depth: viewDepth(view.path),
      parent: isParentView(view.path, all),
      child: viewDepth(view.path) > 0,
      isDefault: index === 0,
    }))
    .filter(
      (row) =>
        !filtering.value ||
        row.title.toLowerCase().includes(q) ||
        row.path.toLowerCase().includes(q),
    )
})

watch(rows, () => {
  activeIndex.value = 0
})

async function openList() {
  if (open.value) return
  query.value = ''
  open.value = true
  await nextTick()
  if (props.searchable) searchInput.value?.focus()
  const index = rows.value.findIndex((row) => row.id === props.modelValue)
  activeIndex.value = index >= 0 ? index : 0
  scrollActiveIntoView()
}

function select(row: ViewRow) {
  emit('update:modelValue', row.id)
  open.value = false
}

/** Reordering keeps the dropdown open so several steps stay possible. */
function move(row: ViewRow, direction: ViewMoveDirection) {
  const target = row.index + direction
  if (target < 0 || target >= props.views.length) return
  emit('move', row.id, direction)
  activeIndex.value = target
  scrollActiveIntoView()
}

function onKeydown(e: KeyboardEvent) {
  if (!open.value) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openList()
    }
    return
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    const direction: ViewMoveDirection = e.key === 'ArrowDown' ? 1 : -1
    const row = rows.value[activeIndex.value]
    // Alt + arrow reorders the highlighted view instead of moving the cursor
    if (e.altKey && row && showMoveButtons.value) {
      move(row, direction)
      return
    }
    const count = rows.value.length
    if (count > 0) activeIndex.value = (activeIndex.value + direction + count) % count
    scrollActiveIntoView()
  } else if (e.key === 'Enter' || (e.key === ' ' && !props.searchable)) {
    e.preventDefault()
    const row = rows.value[activeIndex.value]
    if (row) select(row)
  } else if (e.key === 'Escape') {
    // Keep the surrounding dialog open — only close the dropdown
    e.stopPropagation()
    open.value = false
  }
}

async function scrollActiveIntoView() {
  await nextTick()
  listEl.value?.querySelector('.vp-view-option.active')?.scrollIntoView({ block: 'nearest' })
}

function onDocumentPointerDown(e: PointerEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) open.value = false
}
onMounted(() => document.addEventListener('pointerdown', onDocumentPointerDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocumentPointerDown))
</script>

<template>
  <div ref="root" class="vp-view-select" :class="`vp-size-${size}`">
    <div class="vp-view-select-field">
      <MdiIcon
        v-if="selected?.icon"
        class="vp-view-select-icon"
        :icon="selected.icon"
        :size="iconSize"
      />
      <input
        v-if="open && searchable"
        ref="searchInput"
        v-model="query"
        class="vp-view-select-search"
        type="text"
        spellcheck="false"
        :placeholder="$t('common.viewSelect.search')"
        @keydown="onKeydown"
      />
      <button
        v-else
        type="button"
        class="vp-view-select-value"
        :class="{ empty: !selected }"
        :aria-expanded="open"
        @click="open ? (open = false) : openList()"
        @keydown="onKeydown"
      >
        <span class="vp-view-select-title">
          {{ selected?.title || $t('common.viewSelect.empty') }}
        </span>
        <MdiIcon
          v-if="selected && selected.id === defaultViewId"
          class="vp-view-default"
          icon="mdi:star"
          :size="iconSize - 4"
          :title="$t('common.viewSelect.defaultView')"
        />
        <MdiIcon icon="mdi:menu-down" :size="iconSize" />
      </button>
    </div>

    <div v-if="open" ref="listEl" class="vp-view-select-dropdown">
      <div
        v-for="(row, index) in rows"
        :key="row.id"
        class="vp-view-option"
        :class="{
          active: index === activeIndex,
          selected: row.id === modelValue,
          'is-parent': row.parent,
          'is-child': row.child,
          'is-default': row.isDefault,
        }"
        :style="{ '--vp-view-depth': row.depth }"
      >
        <button type="button" class="vp-view-option-main" @click="select(row)">
          <MdiIcon v-if="row.icon" :icon="row.icon" :size="iconSize - 2" />
          <span class="vp-view-option-label">{{ row.title }}</span>
          <MdiIcon
            v-if="row.isDefault"
            class="vp-view-default"
            icon="mdi:star"
            :size="iconSize - 4"
            :title="$t('common.viewSelect.defaultView')"
          />
        </button>
        <div v-if="showMoveButtons" class="vp-view-option-move">
          <button
            type="button"
            :disabled="row.index === 0"
            :title="$t('common.viewSelect.moveUp')"
            @click="move(row, -1)"
          >
            <MdiIcon icon="mdi:arrow-up" :size="iconSize - 4" />
          </button>
          <button
            type="button"
            :disabled="row.index === views.length - 1"
            :title="$t('common.viewSelect.moveDown')"
            @click="move(row, 1)"
          >
            <MdiIcon icon="mdi:arrow-down" :size="iconSize - 4" />
          </button>
        </div>
      </div>
      <p v-if="rows.length === 0" class="vp-view-select-empty">
        {{ $t('common.viewSelect.noResults') }}
      </p>
      <p v-else-if="showMoveButtons" class="vp-view-select-hint">
        {{ $t('common.viewSelect.defaultHint') }}
      </p>
    </div>
  </div>
</template>
