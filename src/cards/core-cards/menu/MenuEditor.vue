<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDashboardStore } from '@/core/config/dashboardStore'
import BaseSelectMenu from '@/core/ui/BaseSelectMenu.vue'
import BaseButton from '@/core/ui/BaseButton.vue'
import BaseInput from '@/core/ui/BaseInput.vue'
import MdiIcon from '@/core/ui/MdiIcon.vue'
import { mdiIconOptions } from '@/core/ui/mdiIconNames'
import {
  MAX_DEPTH,
  maxDepthAt,
  moveBlock,
  newItemId,
  normalizeDepths,
  shiftDepth,
  type MenuItem,
} from './items'

/**
 * WordPress-style menu builder: pick a page (or add a heading) on the
 * left, then order and nest the entries. Labels are free text and stay
 * independent of the page title.
 */
const props = defineProps<{ modelValue: Record<string, unknown> }>()
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, unknown>] }>()

const { t } = useI18n()
const store = useDashboardStore()

const items = computed<MenuItem[]>(() => (props.modelValue.items as MenuItem[] | undefined) ?? [])

function setItems(next: MenuItem[]) {
  emit('update:modelValue', { ...props.modelValue, items: normalizeDepths(next) })
}

// ── Adding ───────────────────────────────────────────────────
const pendingView = ref('')

const viewOptions = computed(() =>
  store.config.views.map((v) => ({ value: v.id, label: v.title, icon: v.icon })),
)

function addView(viewId: string) {
  const view = store.viewById(viewId)
  if (!view) return
  pendingView.value = ''
  setItems([
    ...items.value,
    { id: newItemId(), label: view.title, icon: view.icon, viewId: view.id, depth: 0 },
  ])
}

function addHeading() {
  setItems([...items.value, { id: newItemId(), label: t('cards.menu.newHeading'), depth: 0 }])
}

/** Seed the menu with every page — the usual starting point. */
function addAllViews() {
  setItems([
    ...items.value,
    ...store.config.views.map((v) => ({
      id: newItemId(),
      label: v.title,
      icon: v.icon,
      viewId: v.id,
      depth: 0,
    })),
  ])
}

// ── Editing ──────────────────────────────────────────────────
const expandedId = ref<string | null>(null)

function patch(index: number, change: Partial<MenuItem>) {
  setItems(items.value.map((item, i) => (i === index ? { ...item, ...change } : item)))
}

function remove(index: number) {
  setItems(items.value.filter((_, i) => i !== index))
}
</script>

<template>
  <div class="menu-editor">
    <div class="add-row">
      <BaseSelectMenu
        :model-value="pendingView"
        :options="viewOptions"
        searchable
        :placeholder="t('cards.menu.addPage')"
        @update:model-value="addView($event)"
      />
      <BaseButton @click="addHeading">{{ t('cards.menu.addHeading') }}</BaseButton>
      <BaseButton v-if="items.length === 0" @click="addAllViews">
        {{ t('cards.menu.addAll') }}
      </BaseButton>
    </div>

    <p v-if="items.length === 0" class="empty">{{ t('cards.menu.empty') }}</p>

    <ul v-else class="item-list">
      <li
        v-for="(item, index) in items"
        :key="item.id"
        class="item"
        :style="{ marginInlineStart: item.depth * 20 + 'px' }"
      >
        <div class="item-head">
          <MdiIcon v-if="item.icon" :icon="item.icon" :size="18" />
          <span class="item-label">{{ item.label }}</span>
          <span v-if="!item.viewId" class="badge">{{ t('cards.menu.heading') }}</span>

          <div class="item-actions">
            <button
              class="icon-btn"
              :disabled="index === 0"
              :title="t('cards.menu.moveUp')"
              @click="setItems(moveBlock(items, index, -1))"
            >
              <MdiIcon icon="mdi:arrow-up" :size="16" />
            </button>
            <button
              class="icon-btn"
              :disabled="index === items.length - 1"
              :title="t('cards.menu.moveDown')"
              @click="setItems(moveBlock(items, index, 1))"
            >
              <MdiIcon icon="mdi:arrow-down" :size="16" />
            </button>
            <button
              class="icon-btn"
              :disabled="item.depth >= Math.min(maxDepthAt(items, index), MAX_DEPTH)"
              :title="t('cards.menu.indent')"
              @click="setItems(shiftDepth(items, index, 1))"
            >
              <MdiIcon icon="mdi:arrow-right" :size="16" />
            </button>
            <button
              class="icon-btn"
              :disabled="item.depth === 0"
              :title="t('cards.menu.outdent')"
              @click="setItems(shiftDepth(items, index, -1))"
            >
              <MdiIcon icon="mdi:arrow-left" :size="16" />
            </button>
            <button
              class="icon-btn"
              :title="t('cards.menu.editItem')"
              @click="expandedId = expandedId === item.id ? null : item.id"
            >
              <MdiIcon :icon="expandedId === item.id ? 'mdi:chevron-up' : 'mdi:pencil'" :size="16" />
            </button>
            <button class="icon-btn danger" :title="t('common.delete')" @click="remove(index)">
              <MdiIcon icon="mdi:delete-outline" :size="16" />
            </button>
          </div>
        </div>

        <div v-if="expandedId === item.id" class="item-body">
          <div class="field">
            <span>{{ t('cards.menu.label') }}</span>
            <BaseInput
              :model-value="item.label"
              size="sm"
              @update:model-value="patch(index, { label: String($event) })"
            />
          </div>
          <div class="field">
            <span>{{ t('cards.menu.icon') }}</span>
            <BaseSelectMenu
              :model-value="item.icon ?? ''"
              size="sm"
              :options="mdiIconOptions()"
              searchable
              clearable
              allow-custom
              custom-prefix="mdi:"
              @update:model-value="patch(index, { icon: $event || undefined })"
            />
          </div>
          <div class="field">
            <span>{{ t('cards.menu.target') }}</span>
            <BaseSelectMenu
              :model-value="item.viewId ?? ''"
              size="sm"
              :options="viewOptions"
              clearable
              :placeholder="t('cards.menu.noTarget')"
              @update:model-value="patch(index, { viewId: $event || undefined })"
            />
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.menu-editor {
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
.item-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.item {
  border: 1px solid var(--divider);
  border-radius: 10px;
  background: var(--card-bg);
}
.item-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
}
.item-label {
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
.item-actions {
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
.item-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 10px 10px;
}
.item-body .field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.item-body span {
  font-size: 12px;
  color: var(--text-secondary);
}
</style>
