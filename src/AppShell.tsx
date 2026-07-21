import { useEffect, useMemo, useState } from 'react'
import App from './App'
import { TripMode } from './components/TripMode'
import { planRoute } from './lib/metro'
import { useStoredState } from './lib/storage'
import type { ActiveTrip, RoutePlan } from './types'

export default function AppShell() {
  const [appVersion, setAppVersion] = useState(0)
  const [activeTrip, setActiveTrip] = useStoredState<ActiveTrip | null>('metro-active-trip', null)

  const activeRoute = useMemo(() => {
    if (!activeTrip) return null
    return planRoute(activeTrip.fromId, activeTrip.toId, activeTrip.preference)
  }, [activeTrip])

  useEffect(() => {
    const handleStartTrip = (event: Event) => {
      const route = (event as CustomEvent<RoutePlan>).detail
      if (!route) return
      setActiveTrip({
        fromId: route.from.id,
        toId: route.to.id,
        preference: route.preference,
        currentStationIndex: 0,
        startedAt: Date.now(),
      })
    }

    const handlePreferenceChange = () => setAppVersion((current) => current + 1)

    window.addEventListener('metro-start-trip', handleStartTrip)
    window.addEventListener('metro-route-preference', handlePreferenceChange)
    return () => {
      window.removeEventListener('metro-start-trip', handleStartTrip)
      window.removeEventListener('metro-route-preference', handlePreferenceChange)
    }
  }, [setActiveTrip])

  useEffect(() => {
    if (activeTrip && !activeRoute) setActiveTrip(null)
  }, [activeRoute, activeTrip, setActiveTrip])

  return (
    <>
      <App key={appVersion} />
      {activeTrip && activeRoute && (
        <TripMode
          route={activeRoute}
          currentStationIndex={activeTrip.currentStationIndex}
          onProgress={(currentStationIndex) => setActiveTrip((current) => current ? { ...current, currentStationIndex } : null)}
          onFinish={() => setActiveTrip(null)}
          onCancel={() => setActiveTrip(null)}
        />
      )}
    </>
  )
}
