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
        // These chunks are code-split (React.lazy) and only ever reached by
        // a small slice of visitors — admin pages, spreadsheet/PDF export,
        // the marketing landing page. Most visitors at an event are deep-
        // linked straight to a public event/preview/check-in page on mobile
        // data, so proactively downloading ~1MB+ of chunks they'll likely
        // never open, on every first visit, is pure waste. Excluding them
        // from the precache just means they're fetched normally the one
        // time someone actually navigates there.
        globIgnores: ['assets/excel-*.js', 'assets/pdf-*.js', 'assets/html2canvas-*.js', 'assets/Admin*-*.js', 'assets/LandingPage-*.js'],
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
