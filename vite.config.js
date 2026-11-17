import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'

// Build stamp shown at the bottom of the organizer sidebar (see
// src/lib/appVersion.js). Date-based so an organizer can tell at a glance
// whether they're on today's deploy; Manila time regardless of where the
// build runs (Vercel builds in UTC).
const builtAt = new Date()
const parts = Object.fromEntries(
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(builtAt)
    .map((p) => [p.type, p.value]),
)
const APP_VERSION = `${parts.year}.${parts.month}.${parts.day}-${parts.hour}${parts.minute}`
let commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || ''
if (!commit) {
  try {
    commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    // No git in the build environment (e.g. a CLI upload): the date alone is the version.
  }
}

// Writes dist/version.json, which open tabs poll to learn that a newer build
// is live, independently of the service worker's own update check.
function versionFile() {
  return {
    name: 'dm-version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: APP_VERSION, commit, builtAt: builtAt.toISOString() }),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(APP_VERSION),
    'import.meta.env.VITE_APP_COMMIT': JSON.stringify(commit),
  },
  plugins: [
    react(),
    tailwindcss(),
    versionFile(),
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
