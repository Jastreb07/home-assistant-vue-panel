<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { reloadHost } from '@/core/router/hostSidebar'
import BaseDialog from '@/core/ui/BaseDialog.vue'
import BaseButton from '@/core/ui/BaseButton.vue'

/**
 * Shown when the same dashboard was edited on another device. Reloads on its
 * own after a short countdown so an unattended wall tablet catches up without
 * anyone walking over to it.
 */
const props = defineProps<{
  /** Suppresses the countdown — reloading mid-edit would interrupt the user */
  hold?: boolean
}>()

const { t } = useI18n()

const COUNTDOWN_SECONDS = 5
const remaining = ref(COUNTDOWN_SECONDS)
let timer: number | null = null

function reload() {
  if (timer !== null) clearInterval(timer)
  timer = null
  reloadHost()
}

onMounted(() => {
  if (props.hold) return
  timer = window.setInterval(() => {
    remaining.value -= 1
    if (remaining.value <= 0) reload()
  }, 1000)
})

onBeforeUnmount(() => {
  if (timer !== null) clearInterval(timer)
})
</script>

<template>
  <BaseDialog :title="t('updates.title')" icon="mdi:refresh">
    <p class="message">{{ t('updates.message') }}</p>
    <p v-if="!hold" class="countdown">{{ t('updates.countdown', { seconds: remaining }) }}</p>
    <p v-else class="countdown">{{ t('updates.holdHint') }}</p>
    <template #footer>
      <BaseButton variant="primary" @click="reload">{{ t('updates.reloadNow') }}</BaseButton>
    </template>
  </BaseDialog>
</template>

<style scoped>
.message {
  margin: 0;
  color: var(--text-primary);
  font-size: 14px;
}
.countdown {
  margin: 10px 0 0;
  color: var(--text-secondary);
  font-size: 13px;
}
</style>
