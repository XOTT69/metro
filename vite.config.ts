import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['metro-icon.svg', 'maskable-icon.svg'],
      manifest: {
        name: 'Метро Київ',
        short_name: 'Метро Київ',
        description: 'Офлайн-схема та планувальник маршрутів Київського метро',
        theme_color: '#111827',
        background_color: '#f4f7fb',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: './',
        start_url: './',
        lang: 'uk',
        categories: ['navigation', 'travel', 'utilities'],
        icons: [
          { src: 'metro-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'maskable-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }
        ],
        shortcuts: [
          { name: 'Побудувати маршрут', short_name: 'Маршрут', url: './?tab=route' },
          { name: 'Відкрити схему', short_name: 'Схема', url: './?tab=map' }
        ]
      },
      workbox: {
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/gisserver(?:-stage)?\.kyivcity\.gov\.ua\/.*$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'kyiv-open-data',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 8, maxAgeSeconds: 7 * 24 * 60 * 60 }
            }
          }
        ]
      }
    })
  ]
})
