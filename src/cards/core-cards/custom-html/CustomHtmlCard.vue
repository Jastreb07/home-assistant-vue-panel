<script setup lang="ts">
import { computed } from 'vue'
import { useDashboardStore } from '@/core/config/dashboardStore'
import CustomCardSandbox from '@/core/custom-cards/CustomCardSandbox.vue'

const props = defineProps<{ config: Record<string, unknown> }>()
const store = useDashboardStore()
const definition = computed(() => store.customCardById(String(props.config.definitionId ?? '')))
const sandboxConfig = computed<Record<string, unknown>>(() => {
  const current = definition.value
  if (!current) return { definitionId: props.config.definitionId }
  return Object.fromEntries([
    ['definitionId', current.id],
    ...current.variables.map((variable) => [
      variable.key,
      props.config[variable.key] ?? variable.default,
    ]),
  ])
})
</script>

<template>
  <div class="custom-html-card">
    <CustomCardSandbox
      v-if="definition"
      :definition="definition"
      :config="sandboxConfig"
    />
    <div v-else class="custom-card-missing">Custom card definition not found</div>
  </div>
</template>

<style scoped>
.custom-html-card {
  width: 100%;
  height: 100%;
  min-height: 120px;
  overflow: hidden;
  border-radius: var(--card-radius);
}
.custom-card-missing {
  display: grid;
  place-items: center;
  min-height: 120px;
  padding: 16px;
  border: 2px dashed var(--divider);
  border-radius: var(--card-radius);
  color: var(--text-secondary);
  font-size: 12px;
  text-align: center;
}
</style>
