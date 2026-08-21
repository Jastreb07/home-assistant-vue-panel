<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEntity } from '@/core/ha'

/**
 * Built-in detail view for entities without a matching dialog card: the
 * friendly name, the current state and every attribute Home Assistant
 * reports.
 */
const props = defineProps<{ entityId: string }>()

const { t } = useI18n()
const entity = useEntity(() => props.entityId)

const attributes = computed(() =>
  Object.entries(entity.value?.attributes ?? {})
    .filter(([key]) => key !== 'friendly_name')
    .map(([key, value]) => ({
      key,
      value: typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value),
    })),
)
</script>

<template>
  <div class="detail-fallback">
    <p v-if="!entity" class="missing">{{ t('popups.entityNotFound') }}</p>
    <template v-else>
      <div class="headline">
        <strong>{{ entity.attributes.friendly_name ?? entityId }}</strong>
        <span>{{ entity.state }}</span>
      </div>
      <dl class="attributes">
        <template v-for="attribute in attributes" :key="attribute.key">
          <dt>{{ attribute.key }}</dt>
          <dd>{{ attribute.value }}</dd>
        </template>
      </dl>
      <p v-if="!attributes.length" class="missing">{{ t('popups.noAttributes') }}</p>
    </template>
  </div>
</template>

<style scoped>
.detail-fallback {
  display: grid;
  gap: 14px;
}
.headline {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.headline strong {
  font-size: 16px;
}
.headline span {
  color: var(--accent);
  font-size: 14px;
}
.attributes {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
  gap: 6px 14px;
  margin: 0;
  font-size: 13px;
}
.attributes dt {
  color: var(--text-secondary);
  overflow-wrap: anywhere;
}
.attributes dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.missing {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
}
</style>
