import { createApp, type App as VueApp } from 'vue'
import { createPinia, type Pinia } from 'pinia'
import { createRouter, createWebHashHistory, type Router } from 'vue-router'
import App from './App.vue'
import AppShell from './shell/AppShell.vue'
import { i18n } from './i18n'
import { useDashboardStore } from './core/config/dashboardStore'
import { bootstrapThemeCss, syncThemes } from './core/theme/registry'

export interface MountedVuePanel {
  app: VueApp
  pinia: Pinia
  router: Router
  syncDashboard(dashboardName: string): Promise<void>
  unmount(): void
}

export function mountVuePanel(target: Element): MountedVuePanel {
  const router = createRouter({
    history: createWebHashHistory(),
    routes: [{ path: '/:viewPath(.*)*', component: AppShell }],
  })
  const pinia = createPinia()
  const app = createApp(App)
    .use(pinia)
    .use(router)
    .use(i18n)
  app.mount(target)
  bootstrapThemeCss()

  return {
    app,
    pinia,
    router,
    async syncDashboard(dashboardName: string) {
      await useDashboardStore(pinia).syncFromRemote(dashboardName)
      await syncThemes()
    },
    unmount() {
      useDashboardStore(pinia).disposePersistence()
      app.unmount()
    },
  }
}
