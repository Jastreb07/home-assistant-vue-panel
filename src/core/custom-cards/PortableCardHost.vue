<script setup lang="ts">
import { computed, inject, onMounted, ref, watch } from 'vue'
import { getPortableCard, usePortableCardCatalogRevision } from '@/core/ha'
import type { PortableCardDocument } from '@/core/registry/portableCardTypes'
import type { CardArea } from '@/core/registry/cardRegistry'
import { cardCssContextKey } from '@/core/ui/cardCssContext'
import CardRuntime from './CardRuntime.vue'

const props = defineProps<{
  cardType: string
  config: Record<string, unknown>
  /** Where this instance sits — handed to the card so it can adapt to it */
  area?: CardArea
}>()
const emit = defineEmits<{
  action: [action: string, detail: Record<string, unknown>]
}>()

const definition = ref<PortableCardDocument | null>(null)
const loadError = ref('')
const catalogRevision = usePortableCardCatalogRevision()
const cardCss = inject(cardCssContextKey, null)
const runtimeDefinition = computed(() => {
  if (!definition.value) return null
  const override = cardCss?.value.trim()
  return override
    ? { ...definition.value, css: override }
    : definition.value
})
let loadVersion = 0

function forwardAction(action: string, detail: Record<string, unknown>) {
  emit('action', action, detail)
}

async function load() {
  const version = ++loadVersion
  loadError.value = ''
  definition.value = null
  try {
    const loaded = await getPortableCard(props.cardType)
    if (version === loadVersion) definition.value = loaded
  } catch (error) {
    if (version === loadVersion) {
      loadError.value = error instanceof Error ? error.message : String(error)
    }
  }
}

onMounted(load)
watch([() => props.cardType, catalogRevision], load)
</script>

<template>
  <CardRuntime
    v-if="runtimeDefinition"
    :definition="runtimeDefinition"
    :config="config"
    :area="area"
    @action="forwardAction"
  />
  <div v-else-if="loadError" class="portable-card-error" :title="loadError">
    {{ loadError }}
  </div>
  <div v-else class="portable-card-loading" />
</template>

<style scoped>
.portable-card-loading,
.portable-card-error {
  width: 100%;
  height: 100%;
  min-height: 0;
  border-radius: inherit;
}
.portable-card-loading {
  background: color-mix(in srgb, var(--card-bg) 84%, var(--divider));
}
.portable-card-error {
  display: grid;
  place-items: center;
  padding: 12px;
  border: 1px dashed var(--danger, #ef4444);
  color: var(--danger, #ef4444);
  font-size: 12px;
}
</style>
