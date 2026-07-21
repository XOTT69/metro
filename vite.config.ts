import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['metro-icon.svg', 'maskable-icon.svg'],
      manifest: {
        name: 'Метро Києва',
        short_name: 'Metro Kyiv',
        description: 'Маршрути, станції та офлайн-схема Київського метрополітену',
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
          { name: 'Усі станції', short_name: 'Станції', url: './?tab=stations' },
          { name: 'Відкрити схему', short_name: 'Схема', url: './?tab=map' },
          { name: 'Обрані станції', short_name: 'Обране', url: './?tab=favorites' }
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
