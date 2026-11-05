/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  // Two Vite servers sharing a cache break each other, so browser tests keep their own.
  ...(process.env.LF_E2E ? { cacheDir: 'node_modules/.vite-e2e' } : {}),
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // The voice model's runtime is an ES module, so the worker that loads it has to be one too.
  worker: { format: 'es' },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': `http://127.0.0.1:${process.env.API_PORT ?? 8787}`,
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
