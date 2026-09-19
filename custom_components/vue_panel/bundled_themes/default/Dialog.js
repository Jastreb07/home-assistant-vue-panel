export default function ({ vue, useI18n, components, helpers }) {
  const { computed, nextTick, onBeforeUnmount, onMounted, ref, useId } = vue
  void useI18n
  const { dialogPointerPosition, useDashboardStore, useMediaQuery } = helpers

  return {
    name: 'Dialog',
    components: {
      MdiIcon: components.MdiIcon,
    },
    props: {
      title: { type: String, default: undefined },
      /** Dialog width: md (default), lg, xl, full */
      size: { type: String, default: 'md' },
      /** Optional icon in front of the title */
      icon: { type: String, default: undefined },
      /** Optional HA-style context label above the title */
      subtitle: { type: String, default: undefined },
      /** Explicit dialog width in px — beats the size preset */
      width: { type: Number, default: undefined },
      /** Explicit body height in px — the content decides when unset */
      bodyHeight: { type: Number, default: undefined },
      /** Close when the backdrop outside the dialog is clicked */
      closeOnBackdrop: { type: Boolean, default: false },
      /** Vertical body alignment — normal dialogs default to top */
      contentPosition: { type: String, default: 'top' },
      /** Mobile height — normal dialogs default to full */
      mobileHeight: { type: String, default: 'full' },
    },
    emits: ['close'],
    setup(props, { emit }) {
      const store = useDashboardStore()

      const titleId = `vp-dialog-title-${useId()}`
      const dialog = ref(null)
      const closeButton = ref(null)
      const isReady = ref(false)
      const isClosing = ref(false)
      const openPointer = dialogPointerPosition()
      const isMobile = useMediaQuery('(max-width: 767px)')
      let closeTimer
      let attentionAnimation
      const animationMode = computed(() => (
        isMobile.value ? store.settings.mobileDialogAnimation : store.settings.dialogAnimation
      ))
      const dialogStyle = () => (props.width ? { width: `min(${props.width}px, 100%)` } : undefined)
      const bodyStyle = () => (props.bodyHeight ? { height: `${props.bodyHeight}px` } : undefined)

      function setMotionOrigin(pointer) {
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

      function onKeydown(event) {
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

      return {
        titleId,
        dialog,
        closeButton,
        isReady,
        isClosing,
        animationMode,
        dialogStyle,
        bodyStyle,
        requestClose,
        onBackdropClick,
      }
    },
    template: `
  <Teleport to="body">
    <div
      class="vp-dialog-backdrop"
      :class="{
        'vp-dialog-backdrop--closing': isClosing,
        'vp-dialog-backdrop--mobile-fit': mobileHeight === 'fit-content',
      }"
      @click.self="onBackdropClick"
    >
      <div
        ref="dialog"
        class="vp-dialog"
        :class="[
          \`vp-dialog--\${size}\`,
          \`vp-dialog--animation-\${animationMode}\`,
          \`vp-dialog--mobile-\${mobileHeight}\`,
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
          :class="\`vp-dialog-body--\${contentPosition}\`"
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
    `,
  }
}
