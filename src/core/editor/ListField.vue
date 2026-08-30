<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CardSchemaField, CardSchemaListItemField } from '@/core/registry/cardRegistry'
import type { CardTranslations } from '@/core/registry/portableCardTypes'
import { useDashboardStore } from '@/core/config/dashboardStore'
import BaseSelectMenu from '@/core/ui/BaseSelectMenu.vue'
import BaseButton from '@/core/ui/BaseButton.vue'
import EntityPicker from './EntityPicker.vue'
import MdiIcon from '@/core/ui/MdiIcon.vue'
import type { SelectOption } from '@/core/ui/selectMenu'
import {
  MAX_LIST_DEPTH,
  maxDepthAt,
  moveBlock,
  moveBlockTo,
  newEntryId,
  normalizeDepths,
  removeBlock,
  shiftDepth,
  toEntries,
  type ListEntry,
} from './listItems'

/**
 * Editor for a `list` card variable: a WordPress-style builder that adds,
 * orders, indents and edits repeated entries. Item fields cannot be lists
 * themselves, so the recursive SchemaForm import terminates.
 */
const SchemaForm = defineAsyncComponent(() => import('./SchemaForm.vue'))

const props = defineProps<{
  field: CardSchemaField
  modelValue: unknown
  /** Catalogs of the card this list belongs to — its item labels use them */
  translations?: CardTranslations
}>()
const emit = defineEmits<{ 'update:modelValue': [value: ListEntry[]] }>()

const { t } = useI18n()
const store = useDashboardStore()

const itemFields = computed<CardSchemaListItemField[]>(() => props.field.itemFields ?? [])
const items = computed<ListEntry[]>(() => toEntries(props.modelValue))
const nestable = computed(() => props.field.nestable === true)

/** Item schema for the reused SchemaForm — keyed like the stored entry. */
const itemSchema = computed<Record<string, CardSchemaField>>(() =>
  Object.fromEntries(itemFields.value.map((item) => [item.key, item])),
)

/** Conventions that let a generic list feel like a menu builder. */
const labelKey = computed(() => itemFields.value.find((f) => f.type === 'string')?.key)
const iconKey = computed(() => itemFields.value.find((f) => f.type === 'icon')?.key)
const viewKey = computed(() => itemFields.value.find((f) => f.type === 'view')?.key)
const entityKey = computed(() => itemFields.value.find((f) => f.type === 'entity')?.key)
const entityDomain = computed(() => itemFields.value.find((f) => f.type === 'entity')?.domain)

/**
 * Some lists (the menu card's items) offer an `action` field whose options go
 * beyond opening a view — a back step, Home Assistant's own screens. Those
 * are self-contained entries needing neither view nor url, so the add menu
 * offers them directly instead of making people pick an action by hand.
 */
const actionField = computed(() => itemFields.value.find((f) => f.key === 'action'))
const actionKey = computed(() => actionField.value?.key)

/** Action values the add menu offers as ready-made entries, in this order. */
const SYSTEM_ACTIONS = ['custom', 'back', 'settings', 'notifications'] as const
const SYSTEM_ICONS: Record<string, string> = {
  custom: 'mdi:link-variant',
  back: 'mdi:arrow-left',
  settings: 'mdi:cog',
  notifications: 'mdi:bell',
}

const systemActions = computed(() => {
  const available = actionField.value?.options ?? []
  return SYSTEM_ACTIONS.filter((action) => action === 'custom' || available.includes(action))
})

/**
 * Views first, then the system entries — the split the dropdown shows as two
 * headed sections. Values are prefixed so a system entry can never collide
 * with a view id.
 */
const viewOptions = computed<SelectOption[]>(() => {
  const views: SelectOption[] = store.config.views.map((v) => ({
    value: `view:${v.id}`,
    label: v.title,
    icon: v.icon,
    group: t('editor.list.groupViews'),
  }))
  if (!actionField.value) return views
  return [
    ...views,
    ...systemActions.value.map((action) => ({
      value: `system:${action}`,
      label: t(`editor.list.systemEntries.${action}`),
      icon: SYSTEM_ICONS[action] ?? 'mdi:cog',
      group: t('editor.list.groupSystem'),
    })),
  ]
})

const pendingView = ref('')
const pendingEntity = ref('')
const expandedId = ref<string | null>(null)

// ── Drag & drop reordering ────────────────────────────────────
const draggingId = ref<string | null>(null)
const dropIndex = ref<number | null>(null)

function onDragStart(event: DragEvent, index: number) {
  draggingId.value = items.value[index]!.id
  dropIndex.value = index
  event.dataTransfer!.setData('text/plain', items.value[index]!.id)
  event.dataTransfer!.effectAllowed = 'move'
}

function onDragOver(event: DragEvent, index: number) {
  if (!draggingId.value) return
  event.preventDefault()
  event.dataTransfer!.dropEffect = 'move'
  dropIndex.value = index
}

function onDrop(event: DragEvent) {
  if (!draggingId.value) return
  event.preventDefault()
  const from = items.value.findIndex((entry) => entry.id === draggingId.value)
  if (from >= 0 && dropIndex.value !== null) setItems(moveBlockTo(items.value, from, dropIndex.value))
  onDragEnd()
}

function onDragEnd() {
  draggingId.value = null
  dropIndex.value = null
}

function setItems(next: ListEntry[]) {
  emit('update:modelValue', normalizeDepths(next))
}

function blankEntry(): ListEntry {
  return { id: newEntryId(), depth: 0 }
}

function entryForView(viewId: string): ListEntry | null {
  const view = store.viewById(viewId)
  if (!view) return null
  const entry = blankEntry()
  if (viewKey.value) entry[viewKey.value] = view.id
  if (labelKey.value) entry[labelKey.value] = view.title
  if (iconKey.value && view.icon) entry[iconKey.value] = view.icon
  return entry
}

/**
 * One dropdown, two kinds of entry: a view to link to, or a ready-made
 * system entry. A back step goes to the top of the list, where it belongs;
 * everything else is appended.
 */
function addFromMenu(value: string) {
  pendingView.value = ''

  if (value.startsWith('view:')) {
    const entry = entryForView(value.slice('view:'.length))
    if (entry) setItems([...items.value, entry])
    return
  }
  if (!value.startsWith('system:')) return

  const action = value.slice('system:'.length)
  const entry = blankEntry()

  // 'custom' is a plain entry the user fills in — it needs no stored action.
  if (actionKey.value && action !== 'custom') entry[actionKey.value] = action
  if (labelKey.value && action === 'custom') entry[labelKey.value] = t('editor.list.newEntry')

  setItems(action === 'back' ? [entry, ...items.value] : [...items.value, entry])
  expandedId.value = entry.id
}

function addAllViews() {
  const entries = store.config.views
    .map((v) => entryForView(v.id))
    .filter((entry): entry is ListEntry => entry !== null)
  setItems([...items.value, ...entries])
}

function addEntry() {
  const entry = blankEntry()
  if (labelKey.value) entry[labelKey.value] = t('editor.list.newEntry')
  setItems([...items.value, entry])
  expandedId.value = entry.id
}


/** Quick add for entity based lists, mirroring the view picker. */
function addEntity(entityId: string) {
  pendingEntity.value = ''
  if (!entityId || !entityKey.value) return
  const entry = blankEntry()
  entry[entityKey.value] = entityId
  setItems([...items.value, entry])
}

function patch(index: number, value: Record<string, unknown>) {
  setItems(items.value.map((item, i) => (i === index ? { ...item, ...value } : item)))
}

function titleOf(entry: ListEntry): string {
  const label = labelKey.value ? entry[labelKey.value] : undefined
  if (typeof label === 'string' && label.trim()) return label
  const view = viewKey.value ? entry[viewKey.value] : undefined
  if (typeof view === 'string' && view) return store.viewById(view)?.title ?? view
  const entity = entityKey.value ? entry[entityKey.value] : undefined
  if (typeof entity === 'string' && entity) return entity
  return t('editor.list.entry')
}

function iconOf(entry: ListEntry): string | undefined {
  const icon = iconKey.value ? entry[iconKey.value] : undefined
  return typeof icon === 'string' && icon ? icon : undefined
}

/**
 * An entry without a target only structures the list, like a heading.
 * Besides the view field, a `url` field counts as a target too, and an
 * `action` other than the default acts on its own — that is the convention
 * for lists offering more than a plain view link.
 */
function isHeading(entry: ListEntry): boolean {
  if (!viewKey.value) return false
  const filled = (key: string | undefined): boolean => {
    const value = key ? entry[key] : undefined
    return typeof value === 'string' && value.trim() !== ''
  }
  const action = actionKey.value ? entry[actionKey.value] : undefined
  if (typeof action === 'string' && action && action !== 'navigate') return false
  const urlKey = itemFields.value.find((f) => f.key === 'url')?.key
  return !filled(viewKey.value) && !filled(urlKey)
}
</script>

<template>
  <div class="list-field">
    <div class="add-row">
      <BaseSelectMenu
        v-if="viewKey"
        :model-value="pendingView"
        :options="viewOptions"
        searchable
        size="sm"
        :placeholder="t('editor.list.addView')"
        @update:model-value="addFromMenu($event)"
      />
      <EntityPicker
        v-else-if="entityKey"
        :model-value="pendingEntity"
        :domain="entityDomain || undefined"
        @update:model-value="addEntity($event)"
      />
      <BaseButton size="sm" @click="addEntry">{{ t('editor.list.addEntry') }}</BaseButton>
      <BaseButton v-if="viewKey && items.length === 0" size="sm" @click="addAllViews">
        {{ t('editor.list.addAllViews') }}
      </BaseButton>
    </div>

    <p v-if="items.length === 0" class="empty">{{ t('editor.list.empty') }}</p>

    <ul v-else class="entry-list">
      <li
        v-for="(entry, index) in items"
        :key="entry.id"
        class="entry"
        :class="{ dragging: draggingId === entry.id, 'drop-target': draggingId !== null && draggingId !== entry.id && dropIndex === index }"
        :style="{ marginInlineStart: entry.depth * 20 + 'px' }"
        @dragover="onDragOver($event, index)"
        @drop="onDrop"
      >
        <div class="entry-head">
          <button
            type="button"
            class="icon-btn drag-handle"
            draggable="true"
            :title="t('editor.list.dragHint')"
            @dragstart="onDragStart($event, index)"
            @dragend="onDragEnd"
          >
            <MdiIcon icon="mdi:drag-horizontal-variant" :size="16" />
          </button>
          <MdiIcon v-if="iconOf(entry)" :icon="iconOf(entry)!" :size="18" />
          <span class="entry-label">{{ titleOf(entry) }}</span>
          <span v-if="isHeading(entry)" class="badge">{{ t('editor.list.heading') }}</span>

          <div class="entry-actions">
            <button
              class="icon-btn"
              :disabled="index === 0"
              :title="t('editor.list.moveUp')"
              @click="setItems(moveBlock(items, index, -1))"
            >
              <MdiIcon icon="mdi:arrow-up" :size="16" />
            </button>
            <button
              class="icon-btn"
              :disabled="index === items.length - 1"
              :title="t('editor.list.moveDown')"
              @click="setItems(moveBlock(items, index, 1))"
            >
              <MdiIcon icon="mdi:arrow-down" :size="16" />
            </button>
            <template v-if="nestable">
              <button
                class="icon-btn"
                :disabled="entry.depth >= Math.min(maxDepthAt(items, index), MAX_LIST_DEPTH)"
                :title="t('editor.list.indent')"
                @click="setItems(shiftDepth(items, index, 1))"
              >
                <MdiIcon icon="mdi:arrow-right" :size="16" />
              </button>
              <button
                class="icon-btn"
                :disabled="entry.depth === 0"
                :title="t('editor.list.outdent')"
                @click="setItems(shiftDepth(items, index, -1))"
              >
                <MdiIcon icon="mdi:arrow-left" :size="16" />
              </button>
            </template>
            <button
              class="icon-btn"
              :title="t('editor.list.editEntry')"
              @click="expandedId = expandedId === entry.id ? null : entry.id"
            >
              <MdiIcon
                :icon="expandedId === entry.id ? 'mdi:chevron-up' : 'mdi:pencil'"
                :size="16"
              />
            </button>
            <button
              class="icon-btn danger"
              :title="t('common.delete')"
              @click="setItems(removeBlock(items, index))"
            >
              <MdiIcon icon="mdi:delete-outline" :size="16" />
            </button>
          </div>
        </div>

        <div v-if="expandedId === entry.id" class="entry-body">
          <SchemaForm
            :schema="itemSchema"
            :translations="translations"
            :grouped="false"
            :model-value="entry"
            @update:model-value="patch(index, $event)"
          />
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.list-field {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.add-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.add-row > :first-child {
  flex: 1;
  min-width: 0;
}
.empty {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
}
.entry-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.entry {
  border: 1px solid var(--divider);
  border-radius: 10px;
  background: var(--card-bg);
}
.entry.dragging {
  opacity: 0.4;
}
.entry.drop-target {
  outline: 2px dashed var(--accent);
  outline-offset: -2px;
}
.drag-handle {
  cursor: grab;
}
.drag-handle:active {
  cursor: grabbing;
}
.entry-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
}
.entry-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}
.badge {
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
  border: 1px solid var(--divider);
  border-radius: 6px;
  padding: 1px 5px;
}
.entry-actions {
  display: flex;
  gap: 2px;
}
.icon-btn {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 3px;
  border-radius: 6px;
  display: grid;
  place-items: center;
}
.icon-btn:hover:not(:disabled) {
  color: var(--text-primary);
  background: var(--nav-item-hover);
}
.icon-btn:disabled {
  opacity: 0.3;
  cursor: default;
}
.icon-btn.danger:hover:not(:disabled) {
  color: #e0706f;
}
.entry-body {
  padding: 0 10px 10px;
}
</style>
