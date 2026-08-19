<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { SUPPORTED_LOCALES, setLocale, type AppLocale } from '@/i18n'
import { useDashboardStore } from '@/core/config/dashboardStore'
import { useEntities, useHaStatus } from '@/core/ha'
import { syncPortableCardCatalog } from '@/core/registry/cardRegistry'
import MdiIcon from '@/core/ui/MdiIcon.vue'
import { alertDialog, confirmDialog } from '@/core/ui/dialogService'

// Development tools for local development and Home Assistant administrators.
const open = ref(false)

const { locale } = useI18n()
const store = useDashboardStore()
const { status } = useHaStatus()
const entities = useEntities()

const entityCount = computed(() => Object.keys(entities.value).length)
const hassUrl = (import.meta.env.VITE_HASS_URL as string | undefined) || location.origin

function pickLocale(l: AppLocale) {
  setLocale(l)
}

// ── Dashboard config tools ───────────────────────────────────
async function exportConfig() {
  try {
    const exported = await store.exportDashboard()
    const blob = new Blob([JSON.stringify(exported.document, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = exported.filename
    link.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    await alertDialog(`Dashboard export failed: ${String(error)}`)
  }
}

const fileInput = ref<HTMLInputElement>()

async function importConfig(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const parsed = JSON.parse(await file.text())
    await store.importDashboard(parsed)
  } catch (error) {
    await alertDialog(`Dashboard import failed: ${String(error)}`)
  } finally {
    ;(ev.target as HTMLInputElement).value = ''
  }
}

async function resetConfig() {
  if (await confirmDialog('Reset dashboard config to defaults?')) store.resetToDefault()
}

async function reloadCardCatalog() {
  try {
    await syncPortableCardCatalog()
  } catch (error) {
    await alertDialog(`Card catalog reload failed: ${String(error)}`)
  }
}

</script>

<template>
  <div class="dev-sidebar" :class="{ open }">
    <button class="handle" title="Dev tools" @click="open = !open">
      <MdiIcon :icon="open ? 'mdi:chevron-right' : 'mdi:tools'" :size="20" />
    </button>

    <aside class="panel">
      <h3>Dev Tools</h3>

      <section>
        <h4>Language</h4>
        <p class="hint">Dev only — production follows the HA language.</p>
        <div class="btn-row">
          <button
            v-for="l in SUPPORTED_LOCALES"
            :key="l"
            class="chip"
            :class="{ active: locale === l }"
            @click="pickLocale(l)"
          >
            {{ l.toUpperCase() }}
          </button>
        </div>
      </section>

      <section>
        <h4>Connection</h4>
        <dl>
          <dt>Status</dt>
          <dd :class="'st-' + status">{{ status }}</dd>
          <dt>HA URL</dt>
          <dd class="mono">{{ hassUrl }}</dd>
          <dt>Entities</dt>
          <dd>{{ entityCount }}</dd>
        </dl>
      </section>

      <section>
        <h4>Dashboard</h4>
        <div class="btn-col">
          <button class="tool-btn" @click="store.editMode = !store.editMode">
            <MdiIcon :icon="store.editMode ? 'mdi:pencil-off' : 'mdi:pencil'" :size="16" />
            {{ store.editMode ? 'Exit edit mode' : 'Enter edit mode' }}
          </button>
          <button class="tool-btn" @click="exportConfig">
            <MdiIcon icon="mdi:download" :size="16" />
            Export config (JSON)
          </button>
          <button class="tool-btn" @click="fileInput?.click()">
            <MdiIcon icon="mdi:upload" :size="16" />
            Import config (JSON)
          </button>
          <input ref="fileInput" type="file" accept=".json" hidden @change="importConfig" />
          <button class="tool-btn danger" @click="resetConfig">
            <MdiIcon icon="mdi:restore" :size="16" />
            Reset to defaults
          </button>
        </div>
      </section>

      <section>
        <h4>Cards</h4>
        <p class="hint">Rescan files changed outside the browser editor.</p>
        <button class="tool-btn" @click="reloadCardCatalog">
          <MdiIcon icon="mdi:refresh" :size="16" />
          Reload card catalog
        </button>
      </section>
    </aside>
  </div>
</template>

<style scoped>
.dev-sidebar {
  position: fixed;
  top: 0;
  right: 0;
  height: 100%;
  display: flex;
  align-items: flex-start;
  z-index: 90;
  pointer-events: none;
  transform: translateX(280px);
  transition: transform 0.25s ease;
}
.dev-sidebar.open {
  transform: translateX(0);
}
.handle {
  pointer-events: auto;
  margin-top: 60px;
  width: 34px;
  height: 44px;
  border: 1px solid var(--divider);
  border-right: none;
  border-radius: 10px 0 0 10px;
  background: var(--nav-bg);
  color: var(--accent);
  cursor: pointer;
  display: grid;
  place-items: center;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
}
.panel {
  pointer-events: auto;
  width: 280px;
  height: 100%;
  overflow-y: auto;
  background: var(--nav-bg);
  border-left: 1px solid var(--divider);
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.4);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
h3 {
  margin: 0;
  font-size: 15px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent);
}
section h4 {
  margin: 0 0 8px;
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-secondary);
}
.hint {
  margin: 0 0 8px;
  font-size: 11px;
  color: var(--text-secondary);
}
.btn-row {
  display: flex;
  gap: 6px;
}
.chip {
  border: 1px solid var(--divider);
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  padding: 5px 12px;
  cursor: pointer;
}
.chip.active {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--text-on-active);
}
dl {
  margin: 0;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 12px;
  font-size: 12px;
}
dt {
  color: var(--text-secondary);
}
dd {
  margin: 0;
  word-break: break-all;
}
.mono {
  font-family: monospace;
}
.st-connected {
  color: #7bd88f;
}
.st-connecting {
  color: var(--accent);
}
.st-error,
.st-auth-required {
  color: #e0706f;
}
.btn-col {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tool-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--divider);
  border-radius: 8px;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  padding: 8px 10px;
  cursor: pointer;
  text-align: left;
}
.tool-btn:hover {
  border-color: var(--accent);
}
.tool-btn.danger {
  color: #e0706f;
}
.tool-btn.danger:hover {
  border-color: #b3403f;
}
</style>
