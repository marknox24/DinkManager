import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'
import { initAnalytics } from './lib/analytics'

initAnalytics()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

// Registers src/sw.js (see that file for the offline app-shell + Supabase-
// exclusion rules). Skipped entirely in dev (import.meta.env.DEV) since
// vite-plugin-pwa's devOptions are disabled — a dev-mode SW would otherwise
// intercept HMR's own requests.
//
// onNeedRefresh fires when a new deploy's SW is installed and waiting (see
// sw.js — it no longer self-activates). App.jsx's ServiceWorkerUpdatePrompt
// listens for this event and shows a toast; only once the visitor confirms
// does updateSW(true) post the skip-waiting message and reload.
if (import.meta.env.PROD) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      window.dispatchEvent(new CustomEvent('dm:sw-update-available', { detail: { reload: () => updateSW(true) } }))
    },
  })
}
