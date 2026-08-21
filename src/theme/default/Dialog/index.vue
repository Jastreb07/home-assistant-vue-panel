<script setup lang="ts">
import MdiIcon from '@/core/ui/MdiIcon.vue'

const props = withDefaults(
  defineProps<{
    title: string
    /** Dialog width: md (default), lg, xl, full */
    size?: 'md' | 'lg' | 'xl' | 'full'
    /** Optional icon in front of the title */
    icon?: string
    /** Explicit dialog width in px — beats the size preset */
    width?: number
    /** Explicit body height in px — the content decides when unset */
    bodyHeight?: number
  }>(),
  { size: 'md' },
)
const emit = defineEmits<{ close: [] }>()

const dialogStyle = () => (props.width ? { width: `min(${props.width}px, 100%)` } : undefined)
const bodyStyle = () => (props.bodyHeight ? { height: `${props.bodyHeight}px` } : undefined)
</script>

<template>
  <Teleport to="body">
    <div class="vp-dialog-backdrop" @click.self="emit('close')">
      <div class="vp-dialog" :class="`vp-dialog--${size}`" :style="dialogStyle()">
        <header class="vp-dialog-header">
          <h3>
            <MdiIcon v-if="icon" :icon="icon" :size="18" />
            {{ title }}
          </h3>
          <button class="vp-dialog-close" :aria-label="$t('common.close')" @click="emit('close')">✕</button>
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
