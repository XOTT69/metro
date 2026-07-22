import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import AppShell from './AppShell'
import { ErrorBoundary } from './components/ErrorBoundary'
import { LanguageProvider } from './lib/i18n'
import './styles.css'
import './enhancements.css'
import './station-catalog.css'
import './status.css'
import './map-v060.css'
import './tourist.css'
import './service-board.css'
import './release.css'
import './a11y.css'

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('metro-pwa-update', { detail: () => updateSW(true) }))
  },
  onOfflineReady() {
    window.dispatchEvent(new Event('metro-pwa-offline-ready'))
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <LanguageProvider>
        <AppShell />
      </LanguageProvider>
    </ErrorBoundary>
  </StrictMode>,
)
