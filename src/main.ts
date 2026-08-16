import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import '@mdi/font/css/materialdesignicons.css'
import App from './App.vue'
import AppShell from './shell/AppShell.vue'
import { i18n } from './i18n'
import { connect } from './core/ha'
import { useDashboardStore } from './core/config/dashboardStore'
import { loadGlobalStyles } from './theme/registry'

const router = createRouter({
  // Hash mode: works without server rewrites under /local/vue-panel/
  history: createWebHashHistory(),
  routes: [{ path: '/:viewId?', component: AppShell }],
})

const pinia = createPinia()
createApp(App).use(pinia).use(router).use(i18n).mount('#app')

// Load the default theme's global styles immediately (base look while loading)
loadGlobalStyles()

// Establish the HA connection in the background (status is shown in App.vue),
// then load the dashboard config stored server-side
connect()
  .then(() => useDashboardStore(pinia).syncFromRemote())
  // Re-run: settings.uiTheme is known now — loads the active theme's main.css
  .then(() => loadGlobalStyles())
  .catch((err) => console.error('[vue-panel] Connection failed:', err))
