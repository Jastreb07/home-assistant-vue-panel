<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import MdiIcon from '@/core/ui/MdiIcon.vue'
import { useMediaQuery } from '@/core/composables/useMediaQuery'

defineProps<{
  reserveResizeCorner?: boolean
}>()

const emit = defineEmits<{
  edit: []
  duplicate: []
  copy: []
  cut: []
  delete: []
}>()

const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const menu = ref<HTMLElement | null>(null)
const open = ref(false)
const menuStyle = ref<Record<string, string>>({})
const isMobile = useMediaQuery('(max-width: 767px)')

const actions = [
  { name: 'edit', icon: 'mdi:pencil', label: 'editor.cardActions.edit' },
  { name: 'duplicate', icon: 'mdi:plus-circle-multiple-outline', label: 'editor.cardActions.duplicate' },
  { name: 'copy', icon: 'mdi:content-copy', label: 'editor.cardActions.copy' },
  { name: 'cut', icon: 'mdi:content-cut', label: 'editor.cardActions.cut' },
] as const

async function toggleMenu() {
  open.value = !open.value
  if (!open.value) return
  menuStyle.value = {}
  await nextTick()
  positionMenu()
  menu.value?.querySelector<HTMLButtonElement>('.vp-card-edit-action')?.focus()
}

function positionMenu() {
  const rect = trigger.value?.getBoundingClientRect()
  if (!rect) return
  const width = Math.max(120, Math.min(164, window.innerWidth - 16))
  const height = Math.min(menu.value?.offsetHeight ?? 0, window.innerHeight - 16)
  const gap = 4
  const left = Math.min(window.innerWidth - width - 8, Math.max(8, rect.right - width))
  const top = rect.bottom + height + gap <= window.innerHeight
    ? rect.bottom + gap
    : Math.max(8, rect.top - height - gap)
  menuStyle.value = {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    maxHeight: `${Math.max(80, window.innerHeight - 16)}px`,
  }
}

function run(action: (typeof actions)[number]['name'] | 'delete') {
  open.value = false
  if (action === 'edit') emit('edit')
  else if (action === 'duplicate') emit('duplicate')
  else if (action === 'copy') emit('copy')
  else if (action === 'cut') emit('cut')
  else emit('delete')
}

function onDocumentPointerDown(event: PointerEvent) {
  const target = event.target as Node
  if (open.value && !root.value?.contains(target) && !menu.value?.contains(target)) open.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    event.stopPropagation()
    open.value = false
    trigger.value?.focus()
  }
}

function closeMenu() {
  open.value = false
}

function editFromSurface() {
  if (!isMobile.value) emit('edit')
}

function blockSurfaceScroll(event: Event) {
  if (!isMobile.value) event.preventDefault()
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
  window.addEventListener('resize', closeMenu)
  window.addEventListener('scroll', closeMenu, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  window.removeEventListener('resize', closeMenu)
  window.removeEventListener('scroll', closeMenu, true)
})
</script>

<template>
  <div
    ref="root"
    class="vp-card-edit-overlay"
    :class="{
      'vp-card-edit-overlay--resize': reserveResizeCorner,
      'vp-card-edit-overlay--open': open,
    }"
    @keydown="onKeydown"
  >
    <button
      type="button"
      class="vp-card-edit-surface"
      :aria-label="$t('editor.cardActions.edit')"
      :aria-hidden="isMobile || undefined"
      :tabindex="isMobile ? -1 : 0"
      @click.stop="editFromSurface"
      @wheel="blockSurfaceScroll"
      @touchmove="blockSurfaceScroll"
    >
      <span class="vp-card-edit-pencil">
        <MdiIcon icon="mdi:pencil" :size="20" />
      </span>
    </button>

    <button
      ref="trigger"
      type="button"
      class="vp-card-edit-trigger"
      :title="$t('editor.cardActions.menu')"
      :aria-label="$t('editor.cardActions.menu')"
      :aria-expanded="open"
      @pointerdown.stop
      @click.stop="toggleMenu"
    >
      <MdiIcon icon="mdi:dots-vertical" :size="22" />
    </button>

    <Teleport to="body">
      <div v-if="open" class="vp-card-edit-menu-layer">
        <div
          ref="menu"
          class="vp-card-edit-menu"
          :style="menuStyle"
          role="menu"
          @keydown="onKeydown"
        >
          <button
            v-for="action in actions"
            :key="action.name"
            type="button"
            class="vp-card-edit-action"
            role="menuitem"
            @click="run(action.name)"
          >
            <MdiIcon :icon="action.icon" :size="21" />
            <span>{{ $t(action.label) }}</span>
          </button>
          <div class="vp-card-edit-divider" />
          <button
            type="button"
            class="vp-card-edit-action vp-card-edit-action--delete"
            role="menuitem"
            @click="run('delete')"
          >
            <MdiIcon icon="mdi:delete" :size="21" />
            <span>{{ $t('common.delete') }}</span>
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>
