<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    /** Dialog width: md (default), lg, xl */
    size?: 'md' | 'lg' | 'xl'
  }>(),
  { size: 'md' },
)
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <div class="vp-dialog-backdrop" @click.self="emit('close')">
      <div class="vp-dialog" :class="`vp-dialog--${size}`">
        <header class="vp-dialog-header">
          <h3>{{ title }}</h3>
          <button class="vp-dialog-close" :aria-label="$t('common.close')" @click="emit('close')">✕</button>
        </header>
        <div class="vp-dialog-body">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="vp-dialog-footer">
          <slot name="footer" />
        </footer>
      </div>
    </div>
  </Teleport>
</template>
