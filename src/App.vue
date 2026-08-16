<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useHaStatus } from '@/core/ha'
import DialogHost from '@/core/ui/DialogHost.vue'
import GlobalCss from '@/core/ui/GlobalCss.vue'

const { t } = useI18n()
const { status, errorMessage } = useHaStatus()
</script>

<template>
  <div v-if="status === 'connecting'" class="status-overlay">
    <div class="spinner" />
    <p>{{ t('app.connecting') }}</p>
  </div>
  <div v-else-if="status === 'auth-required'" class="status-overlay">
    <p>{{ t('app.authRequired') }}</p>
  </div>
  <div v-else-if="status === 'error'" class="status-overlay">
    <p>{{ t('app.connectionError', { message: errorMessage }) }}</p>
  </div>
  <RouterView v-else />
  <DialogHost />
  <GlobalCss />
</template>

<style scoped>
.status-overlay {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--text-secondary);
  text-align: center;
  padding: 24px;
}
.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--divider);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
