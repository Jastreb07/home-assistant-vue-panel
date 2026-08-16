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
  // The build is uploaded to Home Assistant under config/www/vue-panel
  // and is then reachable at http://<ha-host>/local/vue-panel/
  base: '/local/vue-panel/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
