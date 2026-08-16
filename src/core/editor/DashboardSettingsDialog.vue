<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DashboardSettings } from '@/core/config/types'
import { useDashboardStore } from '@/core/config/dashboardStore'
import { availableThemes, themeMainCss } from '@/theme/registry'
import BaseDialog from '@/core/ui/BaseDialog.vue'
import BaseButton from '@/core/ui/BaseButton.vue'
import BaseSelectMenu from '@/core/ui/BaseSelectMenu.vue'
import BaseInput from '@/core/ui/BaseInput.vue'
import BaseTabs from '@/core/ui/BaseTabs.vue'
import BaseCodeEditor from '@/core/ui/BaseCodeEditor.vue'

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

// ── Tabs ─────────────────────────────────────────────────────
const tab = ref('settings')
const tabItems = computed(() => [
  { value: 'settings', label: t('editor.tabSettings'), icon: 'mdi:tune' },
  { value: 'css', label: t('editor.tabCss'), icon: 'mdi:language-css3' },
])

// ── Global CSS ───────────────────────────────────────────────
const defaultCss = ref('')
// Pre-filled with the theme's main.css so it can be tweaked in place
const cssDraft = ref(store.settings.customCss ?? '')

onMounted(async () => {
  defaultCss.value = await themeMainCss()
  if (!store.settings.customCss) cssDraft.value = defaultCss.value
})

function resetCss() {
  cssDraft.value = defaultCss.value
}

function save() {
  const uiThemeChanged = uiTheme.value !== store.settings.uiTheme
  // Only store an override when it actually differs from the theme default
  const css = cssDraft.value.trim()
  const isOverride = css !== '' && css !== defaultCss.value.trim()
  store.updateSettings({
    theme: theme.value,
    uiTheme: uiTheme.value,
    screensaverMinutes: Math.max(0, Number(screensaverMinutes.value) || 0),
    autoReturnSeconds: Math.max(0, Number(autoReturnSeconds.value) || 0),
    customCss: isOverride ? cssDraft.value : undefined,
  })
  emit('close')
  // Themed components are cached — a reload applies the new component theme
  if (uiThemeChanged) setTimeout(() => location.reload(), 300)
}
</script>

<template>
  <BaseDialog :title="t('settings.title')" size="lg" @close="emit('close')">
    <BaseTabs v-model="tab" :items="tabItems" class="dialog-tabs" />

    <div v-show="tab === 'settings'" class="settings-form">
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
      <div class="field">
        <span>{{ t('settings.screensaverMinutes') }}</span>
        <BaseInput
          :model-value="screensaverMinutes"
          type="number"
          :min="0"
          :max="720"
          @update:model-value="screensaverMinutes = Number($event)"
        />
        <small>{{ t('settings.zeroDisables') }}</small>
      </div>
      <div class="field">
        <span>{{ t('settings.autoReturnSeconds') }}</span>
        <BaseInput
          :model-value="autoReturnSeconds"
          type="number"
          :min="0"
          :max="3600"
          @update:model-value="autoReturnSeconds = Number($event)"
        />
        <small>{{ t('settings.zeroDisables') }}</small>
      </div>
    </div>

    <div v-show="tab === 'css'" class="css-tab">
      <p class="css-hint">{{ t('settings.cssHint') }}</p>
      <BaseCodeEditor v-model="cssDraft" language="css" min-height="340px" />
      <div class="css-actions">
        <BaseButton size="sm" @click="resetCss">{{ t('editor.cssReset') }}</BaseButton>
      </div>
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
.dialog-tabs {
  margin-bottom: 18px;
}
.css-tab {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.css-hint {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
}
.css-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
