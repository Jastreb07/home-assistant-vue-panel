<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import MdiIcon from '@/core/ui/MdiIcon.vue'

const props = defineProps<{
  config: { title?: string; icon?: string; align?: 'left' | 'center' | 'right'; rule?: boolean }
}>()

const { t } = useI18n()

const align = computed(() => props.config.align ?? 'left')
const rule = computed(() => props.config.rule !== false)
/** Centred headings get a line on both sides, left/right only on the open side. */
const ruleBefore = computed(() => rule.value && align.value !== 'left')
const ruleAfter = computed(() => rule.value && align.value !== 'right')
</script>

<template>
  <div class="section-title-card">
    <div v-if="ruleBefore" class="rule" />
    <MdiIcon v-if="config.icon" :icon="config.icon" :size="20" />
    <h2>{{ config.title || t('cards.sectionTitle.placeholder') }}</h2>
    <div v-if="ruleAfter" class="rule" />
  </div>
</template>

<style scoped>
/* No tile: a heading sits directly on the dashboard background */
.section-title-card {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 0;
  color: var(--text-secondary);
}
.section-title-card h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  white-space: nowrap;
}
.rule {
  flex: 1;
  height: 2px;
  background: var(--divider);
  border-radius: 1px;
}
</style>
