import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // This base is only used by the standalone development build.
  // The integration build uses vite.panel.config.ts and /vue-panel-static/.
  base: '/local/vue-panel/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
