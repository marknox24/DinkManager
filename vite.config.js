import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // injectManifest (not generateSW): src/sw.js is hand-written specifically
    // so the "never cache Supabase requests" rule is explicit, reviewable
    // code — see that file's own comment for why.
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectRegister: false,
      manifest: false, // public/manifest.webmanifest is linked directly in index.html
      injectManifest: {
        // Excludes the offline-sync scratchpad/large media from precache —
        // only the app shell needs to be available before the first fetch.
        globPatterns: ['**/*.{js,css,html,svg}'],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
})
