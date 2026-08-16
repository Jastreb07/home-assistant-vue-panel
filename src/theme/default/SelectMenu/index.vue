<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MdiIcon from '@/core/ui/MdiIcon.vue'
import type { SelectOption } from '@/core/ui/selectMenu'

/**
 * Generic dropdown: replaces the native <select> across the editor.
 * Options may carry an icon; long lists (icons, entities) opt into a
 * search field via `searchable`.
 */
import type { ControlSize } from '@/core/ui/controlSize'

const ICON_SIZE: Record<ControlSize, number> = { xs: 14, sm: 16, md: 22, lg: 24, xl: 26 }

const props = withDefaults(
  defineProps<{
    modelValue: string
    options: SelectOption[]
    /** Field size — shares the scale with Button and Input */
    size?: ControlSize
    /** Show a search field — for long lists */
    searchable?: boolean
    /** Offer an ✕ button that resets the value to '' */
    clearable?: boolean
    /** Accept free text that matches no option (search field only) */
    allowCustom?: boolean
    /** Prepended to free text when missing, e.g. 'mdi:' */
    customPrefix?: string
    /** Shown while no value is set */
    placeholder?: string
    /** Cap for rendered search results */
    maxResults?: number
  }>(),
  { maxResults: 120, size: 'md' },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const iconSize = computed(() => ICON_SIZE[props.size])

const root = ref<HTMLElement | null>(null)
const listEl = ref<HTMLElement | null>(null)
const open = ref(false)
const query = ref('')
const activeIndex = ref(0)

const selected = computed(() => props.options.find((o) => o.value === props.modelValue))

/** Custom values (free text) have no option — show them verbatim. */
const displayLabel = computed(
  () => selected.value?.label || props.modelValue || props.placeholder || '',
)

const results = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!props.searchable) return props.options
  const stripped = props.customPrefix ? q.replace(props.customPrefix, '') : q
  if (!stripped) return props.options.slice(0, props.maxResults)
  // Prefix matches first — they are what people usually mean
  const prefix: SelectOption[] = []
  const rest: SelectOption[] = []
  for (const option of props.options) {
    // Match against the label and the stored value (e.g. entity_id)
    const at = option.label.toLowerCase().indexOf(stripped)
    const atValue = option.value.toLowerCase().indexOf(stripped)
    if (at === 0 || atValue === 0) prefix.push(option)
    else if (at > 0 || atValue > 0) rest.push(option)
    if (prefix.length >= props.maxResults) break
  }
  return prefix.concat(rest).slice(0, props.maxResults)
})

watch(results, () => {
  activeIndex.value = 0
})

async function openList() {
  if (open.value) return
  query.value = ''
  open.value = true
  // Start on the current value so ↑/↓ continues from there
  await nextTick()
  const index = results.value.findIndex((o) => o.value === props.modelValue)
  activeIndex.value = index >= 0 ? index : 0
  listEl.value?.scrollIntoView({ block: 'nearest' })
  scrollActiveIntoView()
}

function select(option: SelectOption) {
  emit('update:modelValue', option.value)
  open.value = false
}

function clear() {
  emit('update:modelValue', '')
  open.value = false
}

/** Free text typed into the search field is a valid value too. */
function commitQuery() {
  const raw = query.value.trim()
  if (!props.allowCustom || !raw) {
    open.value = false
    return
  }
  const prefix = props.customPrefix ?? ''
  emit('update:modelValue', prefix && !raw.startsWith(prefix) ? prefix + raw : raw)
  open.value = false
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
    const step = e.key === 'ArrowDown' ? 1 : -1
    const count = results.value.length
    if (count > 0) activeIndex.value = (activeIndex.value + step + count) % count
    scrollActiveIntoView()
  } else if (e.key === 'Enter' || (e.key === ' ' && !props.searchable)) {
    e.preventDefault()
    const option = results.value[activeIndex.value]
    if (option) select(option)
    else commitQuery()
  } else if (e.key === 'Escape') {
    // Keep the surrounding dialog open — only close the dropdown
    e.stopPropagation()
    open.value = false
  }
}

async function scrollActiveIntoView() {
  await nextTick()
  listEl.value?.querySelector('.vp-select-option.active')?.scrollIntoView({ block: 'nearest' })
}

function onDocumentPointerDown(e: PointerEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) open.value = false
}
onMounted(() => document.addEventListener('pointerdown', onDocumentPointerDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocumentPointerDown))
</script>

<template>
  <div ref="root" class="vp-select" :class="`vp-size-${size}`">
    <div class="vp-select-field">
      <MdiIcon
        v-if="selected?.icon || (allowCustom && modelValue)"
        class="vp-select-icon"
        :icon="selected?.icon || modelValue"
        :size="iconSize"
      />
      <input
        v-if="open && searchable"
        v-model="query"
        class="vp-select-search"
        type="text"
        autofocus
        spellcheck="false"
        :placeholder="$t('common.selectMenu.search')"
        @keydown="onKeydown"
      />
      <button
        v-else
        type="button"
        class="vp-select-value"
        :class="{ empty: !modelValue }"
        :aria-expanded="open"
        @click="open ? (open = false) : openList()"
        @keydown="onKeydown"
      >
        <span>{{ displayLabel || $t('common.selectMenu.empty') }}</span>
        <MdiIcon icon="mdi:menu-down" :size="iconSize" />
      </button>
      <button
        v-if="clearable && modelValue && !open"
        type="button"
        class="vp-select-clear"
        :title="$t('common.selectMenu.clear')"
        @click="clear"
      >
        <MdiIcon icon="mdi:close" :size="iconSize - 4" />
      </button>
    </div>

    <div v-if="open" ref="listEl" class="vp-select-dropdown">
      <button
        v-for="(option, index) in results"
        :key="option.value"
        type="button"
        class="vp-select-option"
        :class="{ active: index === activeIndex, selected: option.value === modelValue }"
        @click="select(option)"
      >
        <MdiIcon v-if="option.icon" :icon="option.icon" :size="iconSize - 2" />
        <span class="vp-select-label">{{ option.label }}</span>
      </button>
      <p v-if="results.length === 0" class="vp-select-empty">
        {{ $t('common.selectMenu.noResults') }}
      </p>
    </div>
  </div>
</template>
