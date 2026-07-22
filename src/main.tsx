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
import './tourist.css'
import './service-board.css'
import './release.css'
import './a11y.css'
import './ux-v110.css'
import './viewport-lock.css'
import './map-labels-v123.css'

const isMapGesture = (event: Event) => {
  const target = event.target
  return target instanceof Element && Boolean(target.closest('.map-scroll-pinch'))
}

const preventGestureZoom = (event: Event) => {
  if (!isMapGesture(event)) event.preventDefault()
}

const preventMultiTouchZoom = (event: TouchEvent) => {
  if (event.touches.length > 1 && !isMapGesture(event)) event.preventDefault()
}

document.addEventListener('gesturestart', preventGestureZoom, { passive: false })
document.addEventListener('gesturechange', preventGestureZoom, { passive: false })
document.addEventListener('gestureend', preventGestureZoom, { passive: false })
document.addEventListener('touchmove', preventMultiTouchZoom, { passive: false })

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
