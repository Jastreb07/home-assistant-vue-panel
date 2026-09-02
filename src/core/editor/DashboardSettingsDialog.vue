<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type {
  BarConfig,
  BarPosition,
  BarScope,
  DashboardSettings,
  DialogAnimation,
} from '@/core/config/types'
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
import {
  applyPanelScale,
  DEFAULT_PANEL_SCALE,
  PANEL_SCALE_MAX,
  PANEL_SCALE_MIN,
  PANEL_SCALE_STEP,
  readPanelScale,
  readViewScale,
  savePanelScale,
  saveViewScale,
  applyViewScale,
} from '@/core/ui/panelScale'

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const store = useDashboardStore()

const theme = ref<DashboardSettings['theme']>(store.settings.theme)
const uiTheme = ref(store.settings.uiTheme)
const screensaverMinutes = ref(store.settings.screensaverMinutes)
const autoReturnSeconds = ref(store.settings.autoReturnSeconds)
const hideHaSidebar = ref(store.settings.hideHaSidebar === true)
const viewTransition = ref(store.settings.viewTransition !== false)
const dialogAnimation = ref<DialogAnimation>(store.settings.dialogAnimation)
const mobileDialogAnimation = ref<DialogAnimation>(store.settings.mobileDialogAnimation)
const initialPanelScale = readPanelScale()
const panelScale = ref(initialPanelScale)
const panelScaleInput = ref(String(initialPanelScale))
const initialViewScale = readViewScale()
const viewScale = ref(initialViewScale)
const viewScaleInput = ref(String(initialViewScale))
let panelScaleCommitted = false
const barDrafts = ref<BarConfig>(JSON.parse(JSON.stringify(store.bars)) as BarConfig)

const themes: DashboardSettings['theme'][] = ['dark', 'light', 'auto']
const uiThemes = availableThemes()

const themeOptions = computed(() =>
  themes.map((th) => ({ value: th, label: t('settings.themes.' + th) })),
)
const uiThemeOptions = uiThemes.map((th) => ({ value: th, label: th }))
const dialogAnimationOptions = computed(() =>
  (['none', 'simple', 'scale', 'slide-up'] as DialogAnimation[]).map((value) => ({
    value,
    label: t(`settings.dialogAnimation.options.${value}`),
  })),
)
const placementOptions = computed(() => (['view', 'full'] as const).map((value) => ({
  value,
  label: t('editor.barPlacement.' + value),
})))
const scopeOptions = computed(() => (['global', 'perView'] as const).map((value) => ({
  value,
  label: t('settings.barScope.' + value),
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
  { value: 'kiosk', label: t('settings.kiosk'), icon: 'mdi:monitor-dashboard' },
  { value: 'scaling', label: t('settings.scaling.tab'), icon: 'mdi:magnify-expand' },
  { value: 'dialogs', label: t('settings.dialogAnimation.tab'), icon: 'mdi:animation-outline' },
  { value: 'css', label: t('editor.tabCss'), icon: 'mdi:language-css3' },
])

// ── Global CSS ───────────────────────────────────────────────
const defaultCss = ref('')
// Pre-filled with the theme's main.css so it can be tweaked in place
const cssDraft = ref(store.settings.customCss ?? '')

onMounted(async () => {
  // Normalized to \n — CodeMirror always round-trips to \n, so comparing
  // against a CRLF source file would make every reset look like an override.
  defaultCss.value = (await themeMainCss()).replace(/\r\n/g, '\n')
  if (!store.settings.customCss) cssDraft.value = defaultCss.value
})

onBeforeUnmount(() => {
  if (!panelScaleCommitted) {
    applyPanelScale(initialPanelScale)
    applyViewScale(initialViewScale)
  }
})

function previewPanelScale(value: unknown) {
  panelScale.value = applyPanelScale(value)
  panelScaleInput.value = String(panelScale.value)
}

function previewViewScale(value: unknown) {
  viewScale.value = applyViewScale(value)
  viewScaleInput.value = String(viewScale.value)
}

function previewPanelScaleSlider(event: Event) {
  previewPanelScale((event.target as HTMLInputElement).value)
}

function previewViewScaleSlider(event: Event) {
  previewViewScale((event.target as HTMLInputElement).value)
}

function updatePanelScaleInput(value: string | number) {
  panelScaleInput.value = String(value)
  const parsed = Number(value)
  if (panelScaleInput.value !== '' && parsed >= PANEL_SCALE_MIN && parsed <= PANEL_SCALE_MAX) {
    previewPanelScale(parsed)
  }
}

function updateViewScaleInput(value: string | number) {
  viewScaleInput.value = String(value)
  const parsed = Number(value)
  if (viewScaleInput.value !== '' && parsed >= PANEL_SCALE_MIN && parsed <= PANEL_SCALE_MAX) {
    previewViewScale(parsed)
  }
}

function commitPanelScaleInput() {
  previewPanelScale(panelScaleInput.value)
}

function commitViewScaleInput() {
  previewViewScale(viewScaleInput.value)
}

function resetPanelScale() {
  previewPanelScale(DEFAULT_PANEL_SCALE)
}

function resetViewScale() {
  previewViewScale(DEFAULT_PANEL_SCALE)
}

function resetCss() {
  cssDraft.value = defaultCss.value
}

// Blurred over the CSS tab until acknowledged once per dialog session
const cssWarningAcknowledged = ref(false)

function save() {
  commitPanelScaleInput()
  commitViewScaleInput()
  const uiThemeChanged = uiTheme.value !== store.settings.uiTheme
  // Only store an override when it actually differs from the theme default
  const css = cssDraft.value.trim()
  const isOverride = css !== '' && css !== defaultCss.value.trim()
  store.updateSettingsAndBars({
    theme: theme.value,
    uiTheme: uiTheme.value,
    screensaverMinutes: Math.max(0, Number(screensaverMinutes.value) || 0),
    autoReturnSeconds: Math.max(0, Number(autoReturnSeconds.value) || 0),
    hideHaSidebar: hideHaSidebar.value,
    viewTransition: viewTransition.value,
    dialogAnimation: dialogAnimation.value,
    mobileDialogAnimation: mobileDialogAnimation.value,
    customCss: isOverride ? cssDraft.value : undefined,
  }, JSON.parse(JSON.stringify(barDrafts.value)) as BarConfig)
  panelScale.value = savePanelScale(panelScale.value)
  viewScale.value = saveViewScale(viewScale.value)
  panelScaleCommitted = true
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
      <div class="device-row">
        <div class="device-label">
          <span>{{ t('settings.viewTransition') }}</span>
          <small>{{ t('settings.viewTransitionHint') }}</small>
        </div>
        <BaseCheckbox v-model="viewTransition" />
      </div>
    </div>

    <div v-show="tab === 'scaling'" class="settings-form scaling-form">
      <p class="tab-hint">{{ t('settings.scaling.hint') }}</p>
      <div class="field">
        <div class="scale-heading">
          <span>{{ t('settings.panelScale') }}</span>
          <BaseButton size="sm" @click="resetPanelScale">{{ t('settings.scaling.reset') }}</BaseButton>
        </div>
        <div class="scale-control">
          <span>{{ PANEL_SCALE_MIN }} %</span>
          <input
            class="scale-slider"
            type="range"
            :value="panelScale"
            :min="PANEL_SCALE_MIN"
            :max="PANEL_SCALE_MAX"
            :step="PANEL_SCALE_STEP"
            :aria-label="t('settings.panelScale')"
            @input="previewPanelScaleSlider"
          >
          <span>{{ PANEL_SCALE_MAX }} %</span>
          <div class="scale-input">
            <BaseInput
              :model-value="panelScaleInput"
              type="number"
              :min="PANEL_SCALE_MIN"
              :max="PANEL_SCALE_MAX"
              :step="1"
              size="sm"
              @update:model-value="updatePanelScaleInput"
              @blur="commitPanelScaleInput"
            />
            <span>%</span>
          </div>
        </div>
        <small>{{ t('settings.panelScaleHint') }}</small>
      </div>
      <div class="field">
        <div class="scale-heading">
          <span>{{ t('settings.viewScale') }}</span>
          <BaseButton size="sm" @click="resetViewScale">{{ t('settings.scaling.reset') }}</BaseButton>
        </div>
        <div class="scale-control">
          <span>{{ PANEL_SCALE_MIN }} %</span>
          <input
            class="scale-slider"
            type="range"
            :value="viewScale"
            :min="PANEL_SCALE_MIN"
            :max="PANEL_SCALE_MAX"
            :step="PANEL_SCALE_STEP"
            :aria-label="t('settings.viewScale')"
            @input="previewViewScaleSlider"
          >
          <span>{{ PANEL_SCALE_MAX }} %</span>
          <div class="scale-input">
            <BaseInput
              :model-value="viewScaleInput"
              type="number"
              :min="PANEL_SCALE_MIN"
              :max="PANEL_SCALE_MAX"
              :step="1"
              size="sm"
              @update:model-value="updateViewScaleInput"
              @blur="commitViewScaleInput"
            />
            <span>%</span>
          </div>
        </div>
        <small>{{ t('settings.viewScaleHint') }}</small>
      </div>
    </div>

    <div v-show="tab === 'kiosk'" class="settings-form">
      <p class="tab-hint">{{ t('settings.kioskHint') }}</p>
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
      <div class="device-row">
        <div class="device-label">
          <span>{{ t('settings.hideHaSidebar') }}</span>
          <small>{{ t('settings.hideHaSidebarHint') }}</small>
        </div>
        <BaseCheckbox v-model="hideHaSidebar" />
      </div>
    </div>

    <div v-show="tab === 'bars'" class="bars-form">
      <p class="tab-hint">{{ t('settings.barsHint') }}</p>
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
            <label>
              <span>{{ t('settings.barScope.label') }}</span>
              <BaseSelectMenu
                :model-value="barDrafts[position].scope ?? 'global'"
                :options="scopeOptions"
                @update:model-value="barDrafts[position].scope = $event as BarScope"
              />
            </label>
          </div>
          <p class="bar-field-hint">{{ t('settings.barScopeHint') }}</p>

          <div v-if="(barDrafts[position].scope ?? 'global') === 'global'" class="device-row">
            <div class="device-label">
              <span>{{ t('settings.barEnabled.label') }}</span>
              <small>{{ t('settings.barEnabled.hint') }}</small>
            </div>
            <BaseCheckbox
              :model-value="barDrafts[position].enabled !== false"
              @update:model-value="barDrafts[position].enabled = $event"
            />
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

    <div v-show="tab === 'dialogs'" class="settings-form dialog-animation-form">
      <p class="tab-hint">{{ t('settings.dialogAnimation.hint') }}</p>
      <div class="field">
        <span>{{ t('settings.dialogAnimation.desktopLabel') }}</span>
        <BaseSelectMenu
          :model-value="dialogAnimation"
          :options="dialogAnimationOptions"
          @update:model-value="dialogAnimation = $event as DialogAnimation"
        />
      </div>
      <div class="field">
        <span>{{ t('settings.dialogAnimation.mobileLabel') }}</span>
        <BaseSelectMenu
          :model-value="mobileDialogAnimation"
          :options="dialogAnimationOptions"
          @update:model-value="mobileDialogAnimation = $event as DialogAnimation"
        />
      </div>
    </div>

    <div v-show="tab === 'css'" class="css-tab">
      <p class="css-hint">{{ t('settings.cssHint') }}</p>
      <div class="css-guarded" :class="{ 'css-guarded--locked': !cssWarningAcknowledged }">
        <div class="css-editor-scroll">
          <BaseCodeEditor v-model="cssDraft" language="css" min-height="340px" />
        </div>
        <div class="css-actions">
          <BaseButton size="sm" @click="resetCss">{{ t('editor.cssReset') }}</BaseButton>
        </div>
        <div v-if="!cssWarningAcknowledged" class="css-warning-overlay">
          <p>{{ t('common.cssWarning') }}</p>
          <BaseButton variant="primary" size="sm" @click="cssWarningAcknowledged = true">
            {{ t('common.ok') }}
          </BaseButton>
        </div>
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
.tab-hint {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
}
.scale-control {
  display: grid;
  grid-template-columns: auto minmax(120px, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  color: var(--text-secondary);
  font-size: 12px;
}
.scale-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.scaling-form > .field + .field {
  padding-top: 16px;
  border-top: 1px solid var(--divider);
}
.dialog-animation-form > .field + .field {
  padding-top: 16px;
  border-top: 1px solid var(--divider);
}
.scale-slider {
  width: 100%;
  accent-color: var(--accent);
  cursor: pointer;
}
.scale-input {
  display: grid;
  grid-template-columns: 64px auto;
  align-items: center;
  gap: 5px;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
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
.css-guarded {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.css-editor-scroll {
  max-height: 340px;
  overflow-y: auto;
  border-radius: 10px;
}
.css-guarded--locked {
  overflow: hidden;
}
.css-guarded--locked > :not(.css-warning-overlay) {
  overflow: hidden !important;
  pointer-events: none;
}
.css-warning-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  text-align: center;
  background: color-mix(in srgb, var(--nav-bg) 92%, transparent);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: 8px;
}
.css-warning-overlay p {
  max-width: 420px;
  margin: 0;
  font-size: 13px;
  color: var(--text-primary);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}
</style>
