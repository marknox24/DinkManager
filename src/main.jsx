import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

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
if (import.meta.env.PROD) {
  registerSW({ immediate: true })
}
