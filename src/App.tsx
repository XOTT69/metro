import { useEffect, useMemo, useState } from 'react'
import { MetroMap } from './components/MetroMap'
import { Icon } from './components/Icon'
import { RouteResult } from './components/RouteResult'
import { StationDetails } from './components/StationDetails'
import { StationPicker } from './components/StationPicker'
import { lines, stationById, stations } from './data/metro'
import { findNearestStation, formatCountdown, getHeadwayMinutes, getNextTrainSeconds, planRoute } from './lib/metro'
import { mergeOfficialCoordinates } from './lib/officialData'
import { useStoredState } from './lib/storage'
import type { Station, ThemeMode } from './types'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Tab = 'route' | 'map' | 'favorites'
type PickerTarget = 'from' | 'to' | null

const initialParams = new URLSearchParams(window.location.search)
const initialFrom = stationById.has(initialParams.get('from') ?? '') ? initialParams.get('from')! : 'vokzalna'
const initialTo = stationById.has(initialParams.get('to') ?? '') ? initialParams.get('to')! : 'maidan-nezalezhnosti'
const initialTab = (['route', 'map', 'favorites'] as Tab[]).includes(initialParams.get('tab') as Tab)
  ? (initialParams.get('tab') as Tab)
  : 'route'

const themeIcon: Record<ThemeMode, 'sun' | 'moon' | 'system'> = {
  light: 'sun',
  dark: 'moon',
  system: 'system',
}

const themeLabel: Record<ThemeMode, string> = {
  light: 'Світла тема',
  dark: 'Темна тема',
  system: 'Системна тема',
}

const nextTheme: Record<ThemeMode, ThemeMode> = { system: 'light', light: 'dark', dark: 'system' }

function App() {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [fromId, setFromId] = useState(initialFrom)
  const [toId, setToId] = useState(initialTo)
  const [picker, setPicker] = useState<PickerTarget>(null)
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null)
  const [favoriteIds, setFavoriteIds] = useStoredState<string[]>('metro-favorites', ['vokzalna', 'maidan-nezalezhnosti'])
  const [theme, setTheme] = useStoredState<ThemeMode>('metro-theme', 'system')
  const [online, setOnline] = useState(navigator.onLine)
  const [officialStations, setOfficialStations] = useState(stations)
  const [dataStatus, setDataStatus] = useState<'loading' | 'official' | 'fallback'>('loading')
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)

  const from = stationById.get(fromId)!
  const to = stationById.get(toId)!
  const selectedStation = selectedStationId ? stationById.get(selectedStationId) : undefined
  const route = useMemo(() => planRoute(fromId, toId), [fromId, toId])
  const favorites = favoriteIds.map((id) => stationById.get(id)).filter(Boolean) as Station[]

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = () => {
      const resolved = theme === 'system' ? (query.matches ? 'dark' : 'light') : theme
      document.documentElement.dataset.theme = resolved
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#080d18' : '#111827')
    }
    applyTheme()
    query.addEventListener('change', applyTheme)
    return () => query.removeEventListener('change', applyTheme)
  }, [theme])

  useEffect(() => {
    const controller = new AbortController()
    mergeOfficialCoordinates(stations, controller.signal)
      .then((result) => {
        setOfficialStations(result)
        setDataStatus('official')
      })
      .catch(() => setDataStatus('fallback'))
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    const handleInstall = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('beforeinstallprompt', handleInstall)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('beforeinstallprompt', handleInstall)
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams()
    params.set('tab', tab)
    if (fromId) params.set('from', fromId)
    if (toId) params.set('to', toId)
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`)
  }, [tab, fromId, toId])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2500)
    return () => window.clearTimeout(timer)
  }, [toast])

  const selectStation = (target: Exclude<PickerTarget, null>, station: Station) => {
    if (target === 'from') setFromId(station.id)
    else setToId(station.id)
    setPicker(null)
  }

  const swapStations = () => {
    setFromId(toId)
    setToId(fromId)
  }

  const toggleFavorite = (stationId: string) => {
    setFavoriteIds((current) =>
      current.includes(stationId) ? current.filter((id) => id !== stationId) : [...current, stationId],
    )
  }

  const locateNearest = () => {
    if (!navigator.geolocation) {
      setToast('Геолокація не підтримується браузером')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const nearest = findNearestStation(coords.latitude, coords.longitude, officialStations)
        setFromId(nearest.station.id)
        setToast(`Найближча станція — ${nearest.station.name}`)
        setLocating(false)
      },
      () => {
        setToast('Не вдалося отримати геолокацію')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 120000 },
    )
  }

  const shareRoute = async () => {
    const url = new URL(window.location.href)
    url.searchParams.set('tab', 'route')
    url.searchParams.set('from', fromId)
    url.searchParams.set('to', toId)
    const text = `Маршрут метро: ${from.name} → ${to.name}${route ? `, приблизно ${route.totalMinutes} хв` : ''}`
    try {
      if (navigator.share) await navigator.share({ title: 'Метро Києва', text, url: url.toString() })
      else {
        await navigator.clipboard.writeText(`${text}\n${url.toString()}`)
        setToast('Посилання скопійовано')
      }
    } catch {
      // The user may close the native sharing dialog.
    }
  }

  const installApp = async () => {
    if (!installPrompt) {
      setToast('На iPhone: Поділитися → На початковий екран')
      return
    }
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') setToast('Застосунок встановлено')
    setInstallPrompt(null)
  }

  const openStation = (stationId: string) => setSelectedStationId(stationId)

  return (
    <div className="app-shell">
      {!online && <div className="offline-banner"><Icon name="offline" size={17} /> Офлайн-режим: схема й маршрути продовжують працювати</div>}

      <header className="topbar">
        <button className="brand" type="button" onClick={() => setTab('route')} aria-label="На головну">
          <span className="brand-mark">M</span>
          <span><strong>Метро Києва</strong><small>маршрути та схема</small></span>
        </button>
        <div className="topbar-actions">
          <button className="icon-button" type="button" onClick={installApp} aria-label="Встановити застосунок" title="Встановити">
            <Icon name="install" />
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={() => setTheme(nextTheme[theme])}
            aria-label={themeLabel[theme]}
            title={themeLabel[theme]}
          >
            <Icon name={themeIcon[theme]} />
          </button>
        </div>
      </header>

      <main>
        {tab === 'route' && (
          <>
            <section className="hero-section">
              <div className="hero-copy">
                <span className="status-chip"><i className={dataStatus === 'official' ? 'online-dot' : 'fallback-dot'} /> {dataStatus === 'official' ? 'Координати КМДА оновлено' : dataStatus === 'loading' ? 'Оновлюємо дані…' : 'Офлайн-дані'}</span>
                <h1>Куди їдемо?</h1>
                <p>Маршрут між усіма 52 станціями з пересадками та орієнтовним часом у дорозі.</p>
              </div>

              <section className="planner-card card">
                <div className="station-select-stack">
                  <button type="button" className="station-select" onClick={() => setPicker('from')}>
                    <span className="selector-icon from-icon"><span /></span>
                    <span className="selector-copy"><small>Звідки</small><strong>{from.name}</strong><em>{lines[from.line].name}</em></span>
                    <Icon name="chevron" size={20} />
                  </button>
                  <button type="button" className="swap-button" onClick={swapStations} aria-label="Поміняти станції місцями"><Icon name="swap" size={20} /></button>
                  <button type="button" className="station-select" onClick={() => setPicker('to')}>
                    <span className="selector-icon to-icon"><Icon name="location" size={16} /></span>
                    <span className="selector-copy"><small>Куди</small><strong>{to.name}</strong><em>{lines[to.line].name}</em></span>
                    <Icon name="chevron" size={20} />
                  </button>
                </div>
                <div className="planner-actions">
                  <button type="button" className="ghost-button" onClick={locateNearest} disabled={locating}>
                    <Icon name="location" size={18} /> {locating ? 'Шукаємо…' : 'Найближча станція'}
                  </button>
                  <button type="button" className="primary-button" onClick={() => setTab('map')}>
                    Показати на схемі <Icon name="map" size={19} />
                  </button>
                </div>
              </section>
            </section>

            {route && <RouteResult route={route} onStationClick={openStation} onShare={shareRoute} />}

            <section className="quick-section">
              <div className="section-heading">
                <div><span className="eyebrow">Швидкий доступ</span><h2>Обрані станції</h2></div>
                <button type="button" className="text-button" onClick={() => setTab('favorites')}>Усі <Icon name="chevron" size={16} /></button>
              </div>
              <div className="station-card-grid">
                {(favorites.length ? favorites.slice(0, 3) : [from]).map((station) => {
                  const line = lines[station.line]
                  return (
                    <button className="favorite-station-card card" type="button" key={station.id} onClick={() => openStation(station.id)}>
                      <span className="favorite-line" style={{ background: line.color }} />
                      <span className="favorite-card-top"><span className="line-pill" style={{ background: line.color }}>{station.line}</span><Icon name="star" size={18} className="filled" /></span>
                      <strong>{station.name}</strong>
                      <span className="favorite-trains">
                        <span><small>до {line.terminalStart}</small><b>{formatCountdown(getNextTrainSeconds(station, false))}</b></span>
                        <span><small>до {line.terminalEnd}</small><b>{formatCountdown(getNextTrainSeconds(station, true))}</b></span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          </>
        )}

        {tab === 'map' && (
          <section className="page-section map-page">
            {route && (
              <div className="map-route-banner card">
                <span><small>Поточний маршрут</small><strong>{from.name} → {to.name}</strong></span>
                <span className="map-route-time">{route.totalMinutes} хв</span>
                <button type="button" className="icon-button" onClick={() => setTab('route')} aria-label="Відкрити маршрут"><Icon name="chevron" /></button>
              </div>
            )}
            <MetroMap activeStationId={selectedStationId ?? undefined} routeStationIds={route?.stationIds} onStationClick={openStation} />
          </section>
        )}

        {tab === 'favorites' && (
          <section className="page-section favorites-page">
            <div className="page-title">
              <span className="eyebrow">Ваші станції</span>
              <h1>Обране</h1>
              <p>Зберігайте станції, якими користуєтесь найчастіше.</p>
            </div>
            {favorites.length > 0 ? (
              <div className="favorites-list">
                {favorites.map((station) => {
                  const line = lines[station.line]
                  return (
                    <article className="favorite-row card" key={station.id}>
                      <button type="button" className="favorite-main" onClick={() => openStation(station.id)}>
                        <span className="line-dot large" style={{ background: line.color }} />
                        <span><strong>{station.name}</strong><small>{line.name} · інтервал зараз {getHeadwayMinutes(station.line) || '—'} хв</small></span>
                        <Icon name="chevron" />
                      </button>
                      <div className="favorite-row-actions">
                        <button type="button" onClick={() => { setFromId(station.id); setTab('route') }}>Звідси</button>
                        <button type="button" onClick={() => { setToId(station.id); setTab('route') }}>Сюди</button>
                        <button type="button" className="remove-favorite" onClick={() => toggleFavorite(station.id)} aria-label="Видалити з обраного"><Icon name="star" size={18} className="filled" /></button>
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="empty-state card"><Icon name="star" size={34} /><h2>Обраних станцій ще немає</h2><p>Відкрийте станцію на схемі та натисніть зірочку.</p><button className="primary-button" type="button" onClick={() => setTab('map')}>Відкрити схему</button></div>
            )}

            <section className="about-card card">
              <Icon name="info" />
              <div><strong>Про дані</strong><p>Назви, структура мережі та координати базуються на відкритих даних Києва. Інтервали й час маршруту в цій версії розрахункові, а не live. «Метро Києва» — незалежний сервіс і не є офіційним застосунком Київського метрополітену.</p></div>
            </section>
          </section>
        )}
      </main>

      <nav className="bottom-nav" aria-label="Основна навігація">
        <button type="button" className={tab === 'route' ? 'active' : ''} onClick={() => setTab('route')}><Icon name="route" /><span>Маршрут</span></button>
        <button type="button" className={tab === 'map' ? 'active' : ''} onClick={() => setTab('map')}><Icon name="map" /><span>Схема</span></button>
        <button type="button" className={tab === 'favorites' ? 'active' : ''} onClick={() => setTab('favorites')}><Icon name="star" /><span>Обране</span></button>
      </nav>

      {picker && (
        <StationPicker
          title={picker === 'from' ? 'Оберіть станцію відправлення' : 'Оберіть станцію призначення'}
          selectedId={picker === 'from' ? fromId : toId}
          favoriteIds={favoriteIds}
          onSelect={(station) => selectStation(picker, station)}
          onClose={() => setPicker(null)}
        />
      )}

      {selectedStation && (
        <StationDetails
          station={selectedStation}
          isFavorite={favoriteIds.includes(selectedStation.id)}
          onToggleFavorite={() => toggleFavorite(selectedStation.id)}
          onClose={() => setSelectedStationId(null)}
          onSetAsFrom={() => { setFromId(selectedStation.id); setSelectedStationId(null); setTab('route') }}
          onSetAsTo={() => { setToId(selectedStation.id); setSelectedStationId(null); setTab('route') }}
        />
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}

export default App
