<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BarConfig, BarPosition, DashboardSettings } from '@/core/config/types'
import { barPositions, barSizeLimits, isSidebar, useDashboardStore } from '@/core/config/dashboardStore'
import { availableThemes, themeMainCss } from '@/theme/registry'
import BaseDialog from '@/core/ui/BaseDialog.vue'
import BaseButton from '@/core/ui/BaseButton.vue'
import BaseSelectMenu from '@/core/ui/BaseSelectMenu.vue'
import BaseInput from '@/core/ui/BaseInput.vue'
import BaseTabs from '@/core/ui/BaseTabs.vue'
import BaseCodeEditor from '@/core/ui/BaseCodeEditor.vue'
import BaseCheckbox from '@/core/ui/BaseCheckbox.vue'
import BaseCollapsible from '@/core/ui/BaseCollapsible.vue'
import { defaultResponsiveVisibility, type ResponsiveVisibility } from '@/core/ui/responsiveCss'

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const store = useDashboardStore()

const theme = ref<DashboardSettings['theme']>(store.settings.theme)
const uiTheme = ref(store.settings.uiTheme)
const screensaverMinutes = ref(store.settings.screensaverMinutes)
const autoReturnSeconds = ref(store.settings.autoReturnSeconds)
const barDrafts = ref<BarConfig>(JSON.parse(JSON.stringify(store.bars)) as BarConfig)

const themes: DashboardSettings['theme'][] = ['dark', 'light', 'auto']
const uiThemes = availableThemes()

const themeOptions = computed(() =>
  themes.map((th) => ({ value: th, label: t('settings.themes.' + th) })),
)
const uiThemeOptions = uiThemes.map((th) => ({ value: th, label: th }))
const placementOptions = computed(() => (['view', 'full'] as const).map((value) => ({
  value,
  label: t('editor.barPlacement.' + value),
})))

function setSize(position: BarPosition, value: number) {
  const limits = barSizeLimits[position]
  barDrafts.value[position].size = Math.min(limits.max, Math.max(limits.min, value || limits.min))
}

// ── Per-bar device visibility ────────────────────────────────
const barIcons: Record<BarPosition, string> = {
  'sidebar-left': 'mdi:dock-left',
  'sidebar-right': 'mdi:dock-right',
  header: 'mdi:dock-top',
  bottom: 'mdi:dock-bottom',
}

/** Older dashboards were saved without the visibility block — fill it in. */
for (const position of barPositions) {
  barDrafts.value[position].visibility = {
    ...defaultResponsiveVisibility,
    ...barDrafts.value[position].visibility,
  }
}

function visibility(position: BarPosition): ResponsiveVisibility {
  return barDrafts.value[position].visibility as ResponsiveVisibility
}

/** Typed breakpoints are only clamped on blur so intermediate input stays editable. */
const breakpointDrafts = ref(
  Object.fromEntries(
    barPositions.map((position) => [position, {
      mobile: String(visibility(position).mobileMax),
      tablet: String(visibility(position).tabletMax),
    }]),
  ) as Record<BarPosition, { mobile: string; tablet: string }>,
)

function commitMobileBreakpoint(position: BarPosition) {
  const current = visibility(position)
  const parsed = Number(breakpointDrafts.value[position].mobile)
  const value = Number.isFinite(parsed) && breakpointDrafts.value[position].mobile !== ''
    ? Math.min(Math.max(Math.round(parsed), 320), 2000)
    : current.mobileMax
  current.mobileMax = value
  breakpointDrafts.value[position].mobile = String(value)
  if (current.tabletMax <= value) {
    current.tabletMax = value + 1
    breakpointDrafts.value[position].tablet = String(value + 1)
  }
}

function commitTabletBreakpoint(position: BarPosition) {
  const current = visibility(position)
  const parsed = Number(breakpointDrafts.value[position].tablet)
  const value = Number.isFinite(parsed) && breakpointDrafts.value[position].tablet !== ''
    ? Math.min(Math.max(Math.round(parsed), current.mobileMax + 1), 4000)
    : current.tabletMax
  current.tabletMax = value
  breakpointDrafts.value[position].tablet = String(value)
}

// ── Tabs ─────────────────────────────────────────────────────
const tab = ref('settings')
const tabItems = computed(() => [
  { value: 'settings', label: t('editor.tabSettings'), icon: 'mdi:tune' },
  { value: 'bars', label: t('settings.bars'), icon: 'mdi:dock-window' },
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
  store.updateSettingsAndBars({
    theme: theme.value,
    uiTheme: uiTheme.value,
    screensaverMinutes: Math.max(0, Number(screensaverMinutes.value) || 0),
    autoReturnSeconds: Math.max(0, Number(autoReturnSeconds.value) || 0),
    customCss: isOverride ? cssDraft.value : undefined,
  }, JSON.parse(JSON.stringify(barDrafts.value)) as BarConfig)
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

    <div v-show="tab === 'bars'" class="bars-form">
      <p class="bars-hint">{{ t('settings.barsHint') }}</p>
      <BaseCollapsible
        v-for="(position, index) in barPositions"
        :key="position"
        :title="t(`settings.barPositions.${position}`)"
        :icon="barIcons[position]"
        :default-open="index === 0"
      >
        <div class="bar-field">
          <small class="bar-field-hint">{{ t(`settings.barPositionHints.${position}`) }}</small>
          <div class="bar-controls">
            <label>
              <span>{{ isSidebar(position) ? t('editor.nav.width') : t('editor.header.height') }}</span>
              <BaseInput
                type="number"
                :model-value="barDrafts[position].size"
                :min="barSizeLimits[position].min"
                :max="barSizeLimits[position].max"
                @update:model-value="setSize(position, Number($event))"
              />
            </label>
            <label v-if="!isSidebar(position)">
              <span>{{ t('editor.barPlacement.label') }}</span>
              <BaseSelectMenu
                :model-value="barDrafts[position].placement ?? 'view'"
                :options="placementOptions"
                @update:model-value="barDrafts[position].placement = $event as 'view' | 'full'"
              />
            </label>
          </div>

          <h4>{{ t('editor.visibility.responsiveDesign') }}</h4>
          <p class="bar-field-hint">{{ t('settings.barVisibilityHint') }}</p>
          <div class="device-list">
            <div class="device-row">
              <div class="device-label">
                <span>{{ t('editor.visibility.mobile') }}</span>
                <small>{{ t('editor.visibility.mobileRange', { max: visibility(position).mobileMax }) }}</small>
              </div>
              <BaseCheckbox v-model="visibility(position).mobile" />
            </div>
            <div class="device-row">
              <div class="device-label">
                <span>{{ t('editor.visibility.tablet') }}</span>
                <small>{{ t('editor.visibility.tabletRange', { min: visibility(position).mobileMax + 1, max: visibility(position).tabletMax }) }}</small>
              </div>
              <BaseCheckbox v-model="visibility(position).tablet" />
            </div>
            <div class="device-row">
              <div class="device-label">
                <span>{{ t('editor.visibility.desktop') }}</span>
                <small>{{ t('editor.visibility.desktopRange', { min: visibility(position).tabletMax + 1 }) }}</small>
              </div>
              <BaseCheckbox v-model="visibility(position).desktop" />
            </div>
          </div>
          <div class="bar-controls">
            <label>
              <span>{{ t('editor.visibility.mobileBreakpoint') }}</span>
              <BaseInput
                :model-value="breakpointDrafts[position].mobile"
                type="number"
                :min="320"
                :max="2000"
                :step="1"
                @update:model-value="breakpointDrafts[position].mobile = String($event)"
                @blur="commitMobileBreakpoint(position)"
              />
            </label>
            <label>
              <span>{{ t('editor.visibility.tabletBreakpoint') }}</span>
              <BaseInput
                :model-value="breakpointDrafts[position].tablet"
                type="number"
                :min="visibility(position).mobileMax + 1"
                :max="4000"
                :step="1"
                @update:model-value="breakpointDrafts[position].tablet = String($event)"
                @blur="commitTabletBreakpoint(position)"
              />
            </label>
          </div>
        </div>
      </BaseCollapsible>
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
.bars-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.bars-hint {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
}
.bar-field {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.bar-controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 12px;
}
.bar-field-hint {
  margin: 0;
  color: var(--text-secondary);
  font-size: 11px;
}
.bar-field h4 {
  margin: 6px 0 0;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
}
.device-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.device-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 44px;
  padding: 6px 0;
  border-bottom: 1px solid var(--divider);
}
.device-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.device-label > span {
  color: var(--text-primary);
  font-size: 13px;
}
.device-label > small {
  color: var(--text-secondary);
  font-size: 11px;
}
@media (max-width: 720px) {
  .bar-controls {
    grid-template-columns: 1fr;
  }
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
