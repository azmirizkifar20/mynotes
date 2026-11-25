import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [vue(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src/frontend', import.meta.url)) } },
  build: {
    outDir: 'dist/frontend',
    manifest: true,
    rolldownOptions: { input: 'src/frontend/main.ts' },
  },
})
