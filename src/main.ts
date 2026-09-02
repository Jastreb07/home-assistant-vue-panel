import '@mdi/font/css/materialdesignicons.css'
import { mountVuePanel } from './bootstrap'
import {
  announceEmbeddedPanelReady,
  configureDevelopmentDashboard,
  connectForEmbeddedPanel,
  connectForDevelopment,
  getDashboardName,
} from './core/ha'
import { applyHaLocale } from './i18n'
import { applyHostRoutePath } from './core/router/panelNavigation'
import { syncPortableCardCatalog } from './core/registry/cardRegistry'
import { startDialogPointerTracking } from './core/ui/dialogPointer'

const target = document.querySelector('#app')
if (!target) throw new Error('Vue Panel development mount element is missing.')

startDialogPointerTracking()
const mounted = mountVuePanel(target)

async function start(): Promise<void> {
  let engineVersion = 'development'
  if (import.meta.env.DEV) {
    configureDevelopmentDashboard()
    await connectForDevelopment()
  } else {
    const context = await connectForEmbeddedPanel()
    engineVersion = context.engineVersion
    applyHaLocale(context.language)
    // Deep links live in the HA URL — adopt them before the dashboard renders.
    applyHostRoutePath(context.routePath)
  }

  await syncPortableCardCatalog()
  await mounted.syncDashboard(getDashboardName())
  announceEmbeddedPanelReady(engineVersion)
}

start()
  .catch((error) => console.error('[vue-panel] Engine startup failed:', error))
