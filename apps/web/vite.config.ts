/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Deferred, so it can't delay the first paint.
      injectRegister: 'script-defer',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'LinguaForge',
        short_name: 'LinguaForge',
        description: 'Entrenamiento intensivo de inglés: recuerdo activo, producción y video.',
        lang: 'es',
        start_url: '/',
        display: 'standalone',
        theme_color: '#141210',
        background_color: '#141210',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Takes over at once, so the very first visit already works offline.
        clientsClaim: true,
        skipWaiting: true,
        // Reminders need a service worker of the same scope, so its code is added to this one.
        importScripts: ['/push-handler.js'],
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
        // The voice worker and the spreadsheet code are large but needed offline.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // The API is always live: an old AI answer or settings response would be wrong.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // The voice runtime is 21 MB, so it's only stored for people who use the voice.
            urlPattern: /\/assets\/ort-wasm.*\.(wasm|mjs)$/,
            handler: 'CacheFirst',
            options: { cacheName: 'voice-runtime', expiration: { maxEntries: 4 } },
          },
        ],
      },
      // Browser tests stay free of a service worker, which would hide their network mocks.
      devOptions: { enabled: !process.env.LF_E2E, type: 'classic' },
    }),
  ],
  // Two Vite servers sharing a cache break each other, so browser tests keep their own.
  ...(process.env.LF_E2E ? { cacheDir: 'node_modules/.vite-e2e' } : {}),
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Only used from a worker, so Vite would otherwise find it on the first click and reload the page.
  optimizeDeps: { include: ['kokoro-js'] },
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
