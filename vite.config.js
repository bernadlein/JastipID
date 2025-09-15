import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Config async + import PWA secara opsional (tidak error jika belum terpasang)
export default defineConfig(async () => {
  let VitePWA
  try {
    // akan berhasil kalau paket terpasang; kalau tidak, lanjut tanpa PWA
    ;({ VitePWA } = await import('vite-plugin-pwa'))
  } catch (e) {
    console.warn('vite-plugin-pwa not installed – building without PWA')
  }

  return {
    plugins: [
      react(),
      VitePWA
        ? VitePWA({
            registerType: 'autoUpdate',
            workbox: { globPatterns: ['**/*.{js,css,html,png,svg,ico}'] },
            manifest: {
              name: 'Jastip Lite',
              short_name: 'Jastip',
              description:
                'Virtual address & batch shipping (Surabaya → Flores)',
              start_url: '/',
              display: 'standalone',
              background_color: '#ffffff',
              theme_color: '#111827',
              lang: 'id',
              icons: [
                { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                {
                  src: '/icons/maskable-512.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'maskable'
                }
              ]
            }
          })
        : null
    ].filter(Boolean)
  }
})
