<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DashboardSettings } from '@/core/config/types'
import { useDashboardStore } from '@/core/config/dashboardStore'
import { availableThemes } from '@/theme/registry'
import BaseDialog from '@/core/ui/BaseDialog.vue'
import BaseButton from '@/core/ui/BaseButton.vue'
import BaseSelectMenu from '@/core/ui/BaseSelectMenu.vue'

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const store = useDashboardStore()

const theme = ref<DashboardSettings['theme']>(store.settings.theme)
const uiTheme = ref(store.settings.uiTheme)
const screensaverMinutes = ref(store.settings.screensaverMinutes)
const autoReturnSeconds = ref(store.settings.autoReturnSeconds)

const themes: DashboardSettings['theme'][] = ['dark', 'light', 'auto']
const uiThemes = availableThemes()

const themeOptions = computed(() =>
  themes.map((th) => ({ value: th, label: t('settings.themes.' + th) })),
)
const uiThemeOptions = uiThemes.map((th) => ({ value: th, label: th }))

function save() {
  const uiThemeChanged = uiTheme.value !== store.settings.uiTheme
  store.updateSettings({
    theme: theme.value,
    uiTheme: uiTheme.value,
    screensaverMinutes: Math.max(0, Number(screensaverMinutes.value) || 0),
    autoReturnSeconds: Math.max(0, Number(autoReturnSeconds.value) || 0),
  })
  emit('close')
  // Themed components are cached — a reload applies the new component theme
  if (uiThemeChanged) setTimeout(() => location.reload(), 300)
}
</script>

<template>
  <BaseDialog :title="t('settings.title')" @close="emit('close')">
    <div class="settings-form">
      <div class="field">
        <span>{{ t('settings.theme') }}</span>
        <BaseSelectMenu
          :model-value="theme"
          :options="themeOptions"
          @update:model-value="theme = $event as DashboardSettings['theme']"
        />
      </div>
      <div class="field">
        <span>{{ t('settings.uiTheme') }}</span>
        <BaseSelectMenu v-model="uiTheme" :options="uiThemeOptions" />
        <small>{{ t('settings.uiThemeHint') }}</small>
      </div>

      <h3>{{ t('settings.kiosk') }}</h3>
      <label>
        <span>{{ t('settings.screensaverMinutes') }}</span>
        <input v-model.number="screensaverMinutes" type="number" min="0" max="720" />
        <small>{{ t('settings.zeroDisables') }}</small>
      </label>
      <label>
        <span>{{ t('settings.autoReturnSeconds') }}</span>
        <input v-model.number="autoReturnSeconds" type="number" min="0" max="3600" />
        <small>{{ t('settings.zeroDisables') }}</small>
      </label>
    </div>
    <template #footer>
      <BaseButton @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton variant="primary" @click="save">{{ t('common.save') }}</BaseButton>
    </template>
  </BaseDialog>
</template>

<style scoped>
.settings-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
label,
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
label span,
.field > span {
  font-size: 13px;
  color: var(--text-secondary);
}
label small,
.field small {
  font-size: 11px;
  color: var(--text-secondary);
  opacity: 0.8;
}
h3 {
  margin: 8px 0 0;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-secondary);
}
</style>
