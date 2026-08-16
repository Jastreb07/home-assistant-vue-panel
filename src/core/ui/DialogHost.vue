<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseDialog from './BaseDialog.vue'
import BaseButton from './BaseButton.vue'
import { activeDialog, advanceQueue } from './dialogService'

/**
 * Renders the active alert/confirm/prompt request from the dialog service
 * using the themed Dialog component. Mounted once in App.vue.
 */
const { t } = useI18n()

const promptValue = ref('')
const promptInput = ref<HTMLInputElement | null>(null)

watch(activeDialog, async (dialog) => {
  if (dialog?.kind === 'prompt') {
    promptValue.value = dialog.defaultValue
    await nextTick()
    promptInput.value?.focus()
    promptInput.value?.select()
  }
})

function title(): string {
  switch (activeDialog.value?.kind) {
    case 'confirm':
      return t('dialog.confirmTitle')
    case 'prompt':
      return t('dialog.promptTitle')
    default:
      return t('dialog.alertTitle')
  }
}

function finish(result?: boolean) {
  const dialog = activeDialog.value
  if (!dialog) return
  if (dialog.kind === 'alert') dialog.resolve()
  else if (dialog.kind === 'confirm') dialog.resolve(result === true)
  else dialog.resolve(result === true ? promptValue.value : null)
  advanceQueue()
}
</script>

<template>
  <BaseDialog v-if="activeDialog" :title="title()" @close="finish(false)">
    <p class="dialog-message">{{ activeDialog.message }}</p>
    <input
      v-if="activeDialog.kind === 'prompt'"
      ref="promptInput"
      v-model="promptValue"
      type="text"
      class="prompt-input"
      @keydown.enter="finish(true)"
      @keydown.esc="finish(false)"
    />
    <template #footer>
      <template v-if="activeDialog.kind === 'alert'">
        <BaseButton variant="primary" @click="finish()">{{ t('common.ok') }}</BaseButton>
      </template>
      <template v-else>
        <BaseButton @click="finish(false)">{{ t('common.cancel') }}</BaseButton>
        <BaseButton variant="primary" @click="finish(true)">{{ t('common.ok') }}</BaseButton>
      </template>
    </template>
  </BaseDialog>
</template>

<style scoped>
.dialog-message {
  margin: 0;
  white-space: pre-line;
}
.prompt-input {
  width: 100%;
  margin-top: 14px;
}
</style>
