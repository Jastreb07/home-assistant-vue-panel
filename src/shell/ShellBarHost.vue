<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BarPosition } from '@/core/config/types'
import { useDashboardStore } from '@/core/config/dashboardStore'
import { cardAreaCss, resolveCardComponent, type CardCssArea } from '@/core/registry/cardRegistry'
import CardCss from '@/core/ui/CardCss.vue'
import CardConfigDialog from '@/core/editor/CardConfigDialog.vue'
import MdiIcon from '@/core/ui/MdiIcon.vue'

const props = defineProps<{ position: BarPosition }>()

const { t } = useI18n()
const store = useDashboardStore()
const card = computed(() => store.bars[props.position])
const component = computed(() => resolveCardComponent(card.value.type))
const cssArea = computed(() => `bar_${props.position}` as CardCssArea)
const css = computed(() => card.value.css ?? cardAreaCss(card.value.type, cssArea.value))
const configOpen = ref(false)

function save(config: Record<string, unknown>, css?: string) {
  store.setBar(props.position, { ...card.value, config, css })
  configOpen.value = false
}
</script>

<template>
  <div
    class="shell-bar-host"
    :class="`shell-bar-host--${position}`"
    :data-vp-card="css ? card.id : undefined"
  >
    <CardCss v-if="css" :card-id="card.id" :css="css" />
    <component :is="component" v-if="component" :config="card.config" />
    <div v-else class="unknown-bar">{{ t('editor.unknownCard', { type: card.type }) }}</div>
    <button
      v-if="store.editMode"
      type="button"
      class="bar-card-edit-trigger"
      :title="t('editor.cardActions.edit')"
      :aria-label="t('editor.cardActions.edit')"
      @click.stop="configOpen = true"
    >
      <MdiIcon icon="mdi:pencil" :size="18" />
    </button>
    <CardConfigDialog
      v-if="configOpen"
      :card-type="card.type"
      :initial-config="card.config"
      :initial-css="card.css"
      :area="cssArea"
      @close="configOpen = false"
      @save="save"
    />
  </div>
</template>

<style scoped>
.shell-bar-host {
  position: relative;
  flex-shrink: 0;
  min-width: 0;
  z-index: 2;
}
.bar-card-edit-trigger {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 8;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 1px solid color-mix(in srgb, var(--divider) 72%, transparent);
  border-radius: 50%;
  padding: 0;
  background: var(--card-bg);
  color: var(--text-primary);
  box-shadow: 0 2px 9px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  opacity: 0;
  visibility: hidden;
  transform: scale(0.9);
  transition: opacity 120ms ease, transform 120ms ease, visibility 120ms;
}
.shell-bar-host:hover > .bar-card-edit-trigger,
.bar-card-edit-trigger:focus-visible {
  opacity: 1;
  visibility: visible;
  transform: scale(1);
}
.bar-card-edit-trigger:hover,
.bar-card-edit-trigger:focus-visible {
  border-color: var(--accent);
  color: var(--accent);
  outline: none;
}
.shell-bar-host--sidebar {
  display: flex;
  height: 100%;
}
.shell-bar-host--sidebar > :deep(*) {
  min-height: 0;
}
.unknown-bar {
  padding: 12px 16px;
  border: 2px dashed var(--divider);
  color: var(--text-secondary);
}
@media (hover: none) {
  .bar-card-edit-trigger {
    opacity: 1;
    visibility: visible;
    transform: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .bar-card-edit-trigger {
    transition: none;
  }
}
</style>
