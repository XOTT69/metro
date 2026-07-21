import { useEffect, useMemo, useRef, useState } from 'react'
import App from './App'
import { StationCatalog } from './components/StationCatalog'
import { StationDetails } from './components/StationDetails'
import { TripMode } from './components/TripMode'
import { MetroStatus } from './components/MetroStatus'
import { ServiceBoard } from './components/ServiceBoard'
import { Icon } from './components/Icon'
import { stationById } from './data/metro'
import { useLanguage } from './lib/i18n'
import { planRoute } from './lib/metro'
import { useStoredState } from './lib/storage'
import type { ActiveTrip, RoutePlan } from './types'

const getStationFromUrl = () => {
  const stationId = new URL(window.location.href).searchParams.get('station')
  return stationId && stationById.has(stationId) ? stationId : null
}

const isCatalogUrl = () => {
  const params = new URL(window.location.href).searchParams
  return params.get('tab') === 'stations' || Boolean(getStationFromUrl())
}

export default function AppShell() {
  const { t } = useLanguage()
  const [appVersion, setAppVersion] = useState(0)
  const [activeTrip, setActiveTrip] = useStoredState<ActiveTrip | null>('metro-active-trip', null)
  const [favoriteIds, setFavoriteIds] = useStoredState<string[]>('metro-favorites', ['vokzalna', 'maidan-nezalezhnosti'])
  const [catalogOpen, setCatalogOpen] = useState(isCatalogUrl)
  const [catalogStationId, setCatalogStationId] = useState<string | null>(getStationFromUrl)
  const returnUrlRef = useRef<string | null>(null)

  const activeRoute = useMemo(() => {
    if (!activeTrip) return null
    return planRoute(activeTrip.fromId, activeTrip.toId, activeTrip.preference)
  }, [activeTrip])

  const catalogStation = catalogStationId ? stationById.get(catalogStationId) : undefined

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

  useEffect(() => {
    const handlePopState = () => {
      setCatalogOpen(isCatalogUrl())
      setCatalogStationId(getStationFromUrl())
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const writeCatalogUrl = (stationId?: string | null, mode: 'push' | 'replace' = 'push') => {
    const url = new URL(window.location.href)
    url.searchParams.set('tab', 'stations')
    if (stationId) url.searchParams.set('station', stationId)
    else url.searchParams.delete('station')
    window.history[mode === 'push' ? 'pushState' : 'replaceState'](null, '', url)
  }

  const openCatalog = () => {
    returnUrlRef.current = window.location.href
    setCatalogOpen(true)
    setCatalogStationId(null)
    writeCatalogUrl(null)
  }

  const openCatalogStation = (stationId: string) => {
    if (!stationById.has(stationId)) return
    if (!catalogOpen) returnUrlRef.current = window.location.href
    setCatalogOpen(true)
    setCatalogStationId(stationId)
    writeCatalogUrl(stationId)
  }

  const closeCatalogStation = () => {
    setCatalogStationId(null)
    writeCatalogUrl(null, 'replace')
  }

  const closeCatalog = () => {
    setCatalogOpen(false)
    setCatalogStationId(null)
    if (returnUrlRef.current) {
      window.history.replaceState(null, '', returnUrlRef.current)
      returnUrlRef.current = null
      return
    }
    const url = new URL(window.location.href)
    url.searchParams.delete('station')
    if (url.searchParams.get('tab') === 'stations') url.searchParams.set('tab', 'route')
    window.history.replaceState(null, '', url)
  }

  const toggleCatalogFavorite = (stationId: string) => {
    const next = favoriteIds.includes(stationId)
      ? favoriteIds.filter((id) => id !== stationId)
      : [...favoriteIds, stationId]
    localStorage.setItem('metro-favorites', JSON.stringify(next))
    setFavoriteIds(next)
    setAppVersion((current) => current + 1)
  }

  const navigateToRoute = (stationId: string, target: 'from' | 'to') => {
    const url = new URL(window.location.href)
    const currentFrom = stationById.has(url.searchParams.get('from') ?? '') ? url.searchParams.get('from')! : 'vokzalna'
    const currentTo = stationById.has(url.searchParams.get('to') ?? '') ? url.searchParams.get('to')! : 'maidan-nezalezhnosti'
    url.searchParams.set('tab', 'route')
    url.searchParams.delete('station')

    if (target === 'from') {
      url.searchParams.set('from', stationId)
      url.searchParams.set('to', currentTo === stationId ? (stationId === 'maidan-nezalezhnosti' ? 'vokzalna' : 'maidan-nezalezhnosti') : currentTo)
    } else {
      url.searchParams.set('to', stationId)
      url.searchParams.set('from', currentFrom === stationId ? (stationId === 'vokzalna' ? 'maidan-nezalezhnosti' : 'vokzalna') : currentFrom)
    }

    window.location.assign(url.toString())
  }

  const overlaysOpen = Boolean(activeTrip || catalogOpen)

  return (
    <>
      <App key={appVersion} />

      <ServiceBoard hidden={overlaysOpen} />
      <MetroStatus hidden={overlaysOpen} />

      {!activeTrip && !catalogOpen && (
        <button type="button" className="stations-launcher" onClick={openCatalog}>
          <span><Icon name="train" size={20} /></span>
          <strong>{t('stationsLauncher')}</strong>
          <small>52</small>
        </button>
      )}

      {catalogOpen && !catalogStation && (
        <StationCatalog favoriteIds={favoriteIds} onOpenStation={openCatalogStation} onClose={closeCatalog} />
      )}

      {catalogOpen && catalogStation && (
        <StationDetails
          station={catalogStation}
          isFavorite={favoriteIds.includes(catalogStation.id)}
          onToggleFavorite={() => toggleCatalogFavorite(catalogStation.id)}
          onClose={closeCatalogStation}
          onSetAsFrom={() => navigateToRoute(catalogStation.id, 'from')}
          onSetAsTo={() => navigateToRoute(catalogStation.id, 'to')}
          onOpenStation={openCatalogStation}
        />
      )}

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
