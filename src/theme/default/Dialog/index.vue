<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import MdiIcon from '@/core/ui/MdiIcon.vue'

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
  }>(),
  { size: 'md', closeOnBackdrop: false },
)
const emit = defineEmits<{ close: [] }>()

const titleId = `vp-dialog-title-${useId()}`
const closeButton = ref<HTMLButtonElement | null>(null)
const isClosing = ref(false)
let closeTimer: ReturnType<typeof setTimeout> | undefined
const dialogStyle = () => (props.width ? { width: `min(${props.width}px, 100%)` } : undefined)
const bodyStyle = () => (props.bodyHeight ? { height: `${props.bodyHeight}px` } : undefined)

function requestClose() {
  if (isClosing.value) return

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    emit('close')
    return
  }

  isClosing.value = true
  closeTimer = setTimeout(() => emit('close'), 180)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  event.preventDefault()
  requestClose()
}

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  await nextTick()
  closeButton.value?.focus({ preventScroll: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (closeTimer) clearTimeout(closeTimer)
})
</script>

<template>
  <Teleport to="body">
    <div
      class="vp-dialog-backdrop"
      :class="{ 'vp-dialog-backdrop--closing': isClosing }"
      @click.self="closeOnBackdrop && requestClose()"
    >
      <div
        class="vp-dialog"
        :class="[`vp-dialog--${size}`, { 'vp-dialog--closing': isClosing }]"
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
        <div class="vp-dialog-body" :style="bodyStyle()">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="vp-dialog-footer">
          <slot name="footer" />
        </footer>
      </div>
    </div>
  </Teleport>
</template>
