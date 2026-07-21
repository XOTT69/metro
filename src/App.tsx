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

interface RecentRoute {
  id: string
  fromId: string
  toId: string
  usedAt: number
}

type Tab = 'route' | 'map' | 'favorites'
type PickerTarget = 'from' | 'to' | 'home' | 'work' | null

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

const formatRecentTime = (timestamp: number) => {
  const elapsedMinutes = Math.max(1, Math.floor((Date.now() - timestamp) / 60000))
  if (elapsedMinutes < 60) return `${elapsedMinutes} хв тому`
  if (elapsedMinutes < 24 * 60) return `${Math.floor(elapsedMinutes / 60)} год тому`
  const date = new Date(timestamp)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return 'Учора'
  return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })
}

function App() {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [fromId, setFromId] = useState(initialFrom)
  const [toId, setToId] = useState(initialTo)
  const [picker, setPicker] = useState<PickerTarget>(null)
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null)
  const [favoriteIds, setFavoriteIds] = useStoredState<string[]>('metro-favorites', ['vokzalna', 'maidan-nezalezhnosti'])
  const [homeStationId, setHomeStationId] = useStoredState<string | null>('metro-home-station', null)
  const [workStationId, setWorkStationId] = useStoredState<string | null>('metro-work-station', null)
  const [recentRoutes, setRecentRoutes] = useStoredState<RecentRoute[]>('metro-recent-routes', [])
  const [theme, setTheme] = useStoredState<ThemeMode>('metro-theme', 'system')
  const [online, setOnline] = useState(navigator.onLine)
  const [officialStations, setOfficialStations] = useState(stations)
  const [dataStatus, setDataStatus] = useState<'loading' | 'official' | 'fallback'>('loading')
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [applyUpdate, setApplyUpdate] = useState<(() => Promise<void>) | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)

  const from = stationById.get(fromId)!
  const to = stationById.get(toId)!
  const homeStation = homeStationId ? stationById.get(homeStationId) : undefined
  const workStation = workStationId ? stationById.get(workStationId) : undefined
  const selectedStation = selectedStationId ? stationById.get(selectedStationId) : undefined
  const route = useMemo(() => planRoute(fromId, toId), [fromId, toId])
  const favorites = favoriteIds.map((id) => stationById.get(id)).filter(Boolean) as Station[]
  const recentRouteCards = useMemo(
    () => recentRoutes
      .map((item) => {
        const recentFrom = stationById.get(item.fromId)
        const recentTo = stationById.get(item.toId)
        const recentPlan = planRoute(item.fromId, item.toId)
        return recentFrom && recentTo && recentPlan ? { ...item, from: recentFrom, to: recentTo, plan: recentPlan } : null
      })
      .filter(Boolean) as Array<RecentRoute & { from: Station; to: Station; plan: NonNullable<ReturnType<typeof planRoute>> }>,
    [recentRoutes],
  )

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
    const handleUpdate = (event: Event) => {
      const updateEvent = event as CustomEvent<() => Promise<void>>
      setApplyUpdate(() => updateEvent.detail)
    }
    const handleOfflineReady = () => setToast('Застосунок готовий працювати без інтернету')
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('beforeinstallprompt', handleInstall)
    window.addEventListener('metro-pwa-update', handleUpdate)
    window.addEventListener('metro-pwa-offline-ready', handleOfflineReady)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('beforeinstallprompt', handleInstall)
      window.removeEventListener('metro-pwa-update', handleUpdate)
      window.removeEventListener('metro-pwa-offline-ready', handleOfflineReady)
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

  const rememberRoute = (nextFromId: string, nextToId: string) => {
    if (nextFromId === nextToId || !stationById.has(nextFromId) || !stationById.has(nextToId)) return
    const id = `${nextFromId}:${nextToId}`
    setRecentRoutes((current) => [
      { id, fromId: nextFromId, toId: nextToId, usedAt: Date.now() },
      ...current.filter((item) => item.id !== id),
    ].slice(0, 5))
  }

  const applyRoute = (nextFromId: string, nextToId: string) => {
    setFromId(nextFromId)
    setToId(nextToId)
    setTab('route')
    rememberRoute(nextFromId, nextToId)
  }

  const selectStation = (target: Exclude<PickerTarget, null>, station: Station) => {
    if (target === 'from') {
      setFromId(station.id)
      rememberRoute(station.id, toId)
    } else if (target === 'to') {
      setToId(station.id)
      rememberRoute(fromId, station.id)
    } else if (target === 'home') {
      setHomeStationId(station.id)
      setToast(`Дім — станція «${station.name}»`)
    } else {
      setWorkStationId(station.id)
      setToast(`Робота — станція «${station.name}»`)
    }
    setPicker(null)
  }

  const swapStations = () => applyRoute(toId, fromId)

  const toggleFavorite = (stationId: string) => {
    setFavoriteIds((current) =>
      current.includes(stationId) ? current.filter((id) => id !== stationId) : [...current, stationId],
    )
  }

  const routeToPlace = (kind: 'home' | 'work') => {
    const stationId = kind === 'home' ? homeStationId : workStationId
    if (!stationId || !stationById.has(stationId)) {
      setPicker(kind)
      return
    }
    applyRoute(fromId, stationId)
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
        rememberRoute(nearest.station.id, toId)
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
    rememberRoute(fromId, toId)
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

  const updateApp = async () => {
    if (!applyUpdate) return
    await applyUpdate()
    setApplyUpdate(null)
  }

  const openStation = (stationId: string) => setSelectedStationId(stationId)

  const pickerTitle = picker === 'from'
    ? 'Оберіть станцію відправлення'
    : picker === 'to'
      ? 'Оберіть станцію призначення'
      : picker === 'home'
        ? 'Оберіть станцію біля дому'
        : 'Оберіть станцію біля роботи'

  const pickerSelectedId = picker === 'from'
    ? fromId
    : picker === 'to'
      ? toId
      : picker === 'home'
        ? homeStationId ?? undefined
        : workStationId ?? undefined

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

            <section className="place-actions" aria-label="Швидкі маршрути">
              <button className="place-action card" type="button" onClick={() => routeToPlace('home')}>
                <span className="place-badge">Д</span>
                <span><small>{homeStation ? 'Додому' : 'Дім'}</small><strong>{homeStation?.name ?? 'Обрати станцію'}</strong></span>
                <Icon name="chevron" size={19} />
              </button>
              <button className="place-action card" type="button" onClick={() => routeToPlace('work')}>
                <span className="place-badge work">Р</span>
                <span><small>{workStation ? 'На роботу' : 'Робота'}</small><strong>{workStation?.name ?? 'Обрати станцію'}</strong></span>
                <Icon name="chevron" size={19} />
              </button>
            </section>

            {route && <RouteResult route={route} onStationClick={openStation} onShare={shareRoute} />}

            {recentRouteCards.length > 0 && (
              <section className="recent-section">
                <div className="section-heading">
                  <div><span className="eyebrow">Швидко повторити</span><h2>Недавні маршрути</h2></div>
                  <button type="button" className="text-button" onClick={() => setRecentRoutes([])}>Очистити</button>
                </div>
                <div className="recent-route-list">
                  {recentRouteCards.slice(0, 4).map((item) => (
                    <button className="recent-route-card card" type="button" key={item.id} onClick={() => applyRoute(item.fromId, item.toId)}>
                      <span className="recent-route-icon"><Icon name="route" size={18} /></span>
                      <span className="recent-route-copy">
                        <strong>{item.from.name} <Icon name="arrow" size={15} /> {item.to.name}</strong>
                        <small>{item.plan.totalMinutes} хв · {item.plan.stationCount} станцій</small>
                      </span>
                      <time dateTime={new Date(item.usedAt).toISOString()}>{formatRecentTime(item.usedAt)}</time>
                    </button>
                  ))}
                </div>
              </section>
            )}

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

            <section className="places-settings card">
              <div className="places-settings-heading">
                <span className="eyebrow">Персоналізація</span>
                <h2>Дім і робота</h2>
                <p>Оберіть найближчі станції для маршрутів в один дотик.</p>
              </div>
              <button type="button" className="place-setting" onClick={() => setPicker('home')}>
                <span className="place-badge">Д</span>
                <span><small>Дім</small><strong>{homeStation?.name ?? 'Станцію не вибрано'}</strong></span>
                <Icon name="chevron" size={19} />
              </button>
              <button type="button" className="place-setting" onClick={() => setPicker('work')}>
                <span className="place-badge work">Р</span>
                <span><small>Робота</small><strong>{workStation?.name ?? 'Станцію не вибрано'}</strong></span>
                <Icon name="chevron" size={19} />
              </button>
            </section>

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
                        <button type="button" onClick={() => applyRoute(station.id, toId)}>Звідси</button>
                        <button type="button" onClick={() => applyRoute(fromId, station.id)}>Сюди</button>
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
          title={pickerTitle}
          selectedId={pickerSelectedId}
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
          onSetAsFrom={() => { setFromId(selectedStation.id); rememberRoute(selectedStation.id, toId); setSelectedStationId(null); setTab('route') }}
          onSetAsTo={() => { setToId(selectedStation.id); rememberRoute(fromId, selectedStation.id); setSelectedStationId(null); setTab('route') }}
        />
      )}

      {applyUpdate && (
        <aside className="update-toast" role="status">
          <span className="update-toast-icon"><Icon name="refresh" size={19} /></span>
          <span><strong>Доступне оновлення</strong><small>Нова версія вже готова</small></span>
          <button type="button" onClick={updateApp}>Оновити</button>
        </aside>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}

export default App
