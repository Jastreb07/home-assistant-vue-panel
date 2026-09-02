<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import MdiIcon from '@/core/ui/MdiIcon.vue'
import { dialogPointerPosition, type DialogPointerPosition } from '@/core/ui/dialogPointer'
import { useDashboardStore } from '@/core/config/dashboardStore'
import type { DialogContentPosition } from '@/core/config/types'

const props = withDefaults(
  defineProps<{
    title: string
    /** Dialog width: md (default), lg, xl, full */
    size?: 'md' | 'lg' | 'xl' | 'full'
    /** Optional icon in front of the title */
    icon?: string
    /** Optional HA-style context label above the title */
    subtitle?: string
    /** Explicit dialog width in px — beats the size preset */
    width?: number
    /** Explicit body height in px — the content decides when unset */
    bodyHeight?: number
    /** Close when the backdrop outside the dialog is clicked */
    closeOnBackdrop?: boolean
    /** Vertical body alignment — normal dialogs default to top */
    contentPosition?: DialogContentPosition
  }>(),
  { size: 'md', closeOnBackdrop: false, contentPosition: 'top' },
)
const emit = defineEmits<{ close: [] }>()
const store = useDashboardStore()

const titleId = `vp-dialog-title-${useId()}`
const dialog = ref<HTMLDivElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)
const isReady = ref(false)
const isClosing = ref(false)
const openPointer = dialogPointerPosition()
let closeTimer: ReturnType<typeof setTimeout> | undefined
let attentionAnimation: Animation | undefined
const animationMode = computed(() => store.settings.dialogAnimation)
const dialogStyle = () => (props.width ? { width: `min(${props.width}px, 100%)` } : undefined)
const bodyStyle = () => (props.bodyHeight ? { height: `${props.bodyHeight}px` } : undefined)

function setMotionOrigin(pointer: DialogPointerPosition) {
  if (!dialog.value) return
  const bounds = dialog.value.getBoundingClientRect()
  const x = pointer.x - bounds.left
  const y = pointer.y - bounds.top
  dialog.value.style.setProperty('--vp-dialog-origin-x', `${x}px`)
  dialog.value.style.setProperty('--vp-dialog-origin-y', `${y}px`)
}

function requestClose() {
  if (isClosing.value) return

  if (
    animationMode.value === 'none'
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    emit('close')
    return
  }

  if (animationMode.value === 'scale') setMotionOrigin(openPointer)
  isClosing.value = true
  closeTimer = setTimeout(
    () => emit('close'),
    animationMode.value === 'simple' ? 180 : 320,
  )
}

function onBackdropClick() {
  if (props.closeOnBackdrop) {
    requestClose()
    return
  }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  attentionAnimation?.cancel()
  attentionAnimation = dialog.value?.animate(
    [
      { left: '0' },
      { left: '-10px', offset: 0.2 },
      { left: '8px', offset: 0.4 },
      { left: '-6px', offset: 0.58 },
      { left: '4px', offset: 0.74 },
      { left: '-2px', offset: 0.88 },
      { left: '0' },
    ],
    { duration: 380, easing: 'cubic-bezier(.22, .61, .36, 1)' },
  )
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  event.preventDefault()
  requestClose()
}

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  await nextTick()
  setMotionOrigin(openPointer)
  isReady.value = true
  closeButton.value?.focus({ preventScroll: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (closeTimer) clearTimeout(closeTimer)
  attentionAnimation?.cancel()
})
</script>

<template>
  <Teleport to="body">
    <div
      class="vp-dialog-backdrop"
      :class="{ 'vp-dialog-backdrop--closing': isClosing }"
      @click.self="onBackdropClick"
    >
      <div
        ref="dialog"
        class="vp-dialog"
        :class="[
          `vp-dialog--${size}`,
          `vp-dialog--animation-${animationMode}`,
          {
            'vp-dialog--ready': isReady,
            'vp-dialog--closing': isClosing,
          },
        ]"
        :style="dialogStyle()"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
      >
        <header class="vp-dialog-header">
          <button
            ref="closeButton"
            class="vp-dialog-close"
            type="button"
            :aria-label="$t('common.close')"
            @click="requestClose"
          >
            <MdiIcon icon="mdi:close" :size="24" />
          </button>
          <div class="vp-dialog-heading">
            <span v-if="subtitle" class="vp-dialog-subtitle">{{ subtitle }}</span>
            <h3 :id="titleId">
              <MdiIcon v-if="icon" :icon="icon" :size="20" />
              <span>{{ title }}</span>
            </h3>
          </div>
          <div v-if="$slots.actions" class="vp-dialog-actions">
            <slot name="actions" />
          </div>
        </header>
        <div
          class="vp-dialog-body"
          :class="`vp-dialog-body--${contentPosition}`"
          :style="bodyStyle()"
        >
          <slot />
        </div>
        <footer v-if="$slots.footer" class="vp-dialog-footer">
          <slot name="footer" />
        </footer>
      </div>
    </div>
  </Teleport>
</template>
