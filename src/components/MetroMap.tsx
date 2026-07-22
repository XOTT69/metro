import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import { lines, stationById, stations, transferPairs } from '../data/metro'
import { useLanguage } from '../lib/i18n'
import type { LineId, Station } from '../types'
import { Icon } from './Icon'

interface Props {
  activeStationId?: string
  routeStationIds?: string[]
  onStationClick: (stationId: string) => void
}

interface MapView {
  x: number
  y: number
  width: number
  height: number
}

interface Point {
  x: number
  y: number
}

interface CanvasSize {
  width: number
  height: number
}

interface LabelPlacement {
  dx: number
  dy: number
  anchor: 'start' | 'middle' | 'end'
}

const FULL_VIEW: MapView = { x: 18, y: 8, width: 924, height: 694 }
const MAP_BOUNDS = { x: 0, y: 0, width: 960, height: 710 }
const MAP_ASPECT = FULL_VIEW.width / FULL_VIEW.height
const MIN_VIEW_WIDTH = 290
const MAX_VIEW_WIDTH = 1080
const lineIds: LineId[] = ['M1', 'M2', 'M3']

const LABEL_OVERRIDES: Record<string, LabelPlacement> = {
  teatralna: { dx: -13, dy: -13, anchor: 'end' },
  'zoloti-vorota': { dx: -14, dy: 17, anchor: 'end' },
  khreshchatyk: { dx: 14, dy: -12, anchor: 'start' },
  'maidan-nezalezhnosti': { dx: 15, dy: 17, anchor: 'start' },
  'ploshcha-ukrainskykh-heroiv': { dx: -14, dy: 4, anchor: 'end' },
  'palats-sportu': { dx: 15, dy: 17, anchor: 'start' },
  universytet: { dx: -9, dy: 17, anchor: 'end' },
  arsenalna: { dx: 0, dy: 17, anchor: 'middle' },
  dnipro: { dx: 0, dy: 17, anchor: 'middle' },
  vokzalna: { dx: -8, dy: 18, anchor: 'end' },
  syrets: { dx: -10, dy: -12, anchor: 'end' },
  vydubychi: { dx: 11, dy: 16, anchor: 'start' },
}

const MAJOR_STATIONS = new Set([
  'vokzalna',
  'universytet',
  'arsenalna',
  'dnipro',
  'khreshchatyk',
  'maidan-nezalezhnosti',
  'teatralna',
  'zoloti-vorota',
  'ploshcha-ukrainskykh-heroiv',
  'palats-sportu',
  'livoberezhna',
  'pochaina',
  'demiivska',
  'vydubychi',
])

const terminalIds = new Set(
  Object.values(lines).flatMap((line) => [line.stationIds[0], line.stationIds.at(-1)!]),
)

const labelPosition = (stationId: string, line: LineId): LabelPlacement => {
  if (LABEL_OVERRIDES[stationId]) return LABEL_OVERRIDES[stationId]
  if (line === 'M1') return { dx: 0, dy: 17, anchor: 'middle' }
  if (line === 'M2') return { dx: -12, dy: 4, anchor: 'end' }
  return { dx: 11, dy: -9, anchor: 'start' }
}

const constrainAxis = (value: number, size: number, boundsStart: number, boundsSize: number) => {
  const overscroll = Math.min(50, size * 0.075)
  const minimum = boundsStart - overscroll
  const maximum = boundsStart + boundsSize - size + overscroll
  if (minimum > maximum) return boundsStart + (boundsSize - size) / 2
  return Math.min(maximum, Math.max(minimum, value))
}

const clampView = (candidate: MapView): MapView => {
  const width = Math.min(MAX_VIEW_WIDTH, Math.max(MIN_VIEW_WIDTH, candidate.width))
  const height = width / MAP_ASPECT
  return {
    x: constrainAxis(candidate.x, width, MAP_BOUNDS.x, MAP_BOUNDS.width),
    y: constrainAxis(candidate.y, height, MAP_BOUNDS.y, MAP_BOUNDS.height),
    width,
    height,
  }
}

const distance = (first: Point, second: Point) => Math.hypot(first.x - second.x, first.y - second.y)
const midpoint = (first: Point, second: Point): Point => ({
  x: (first.x + second.x) / 2,
  y: (first.y + second.y) / 2,
})

const roundedPath = (points: Point[], radius = 16) => {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`

  let path = `M ${points[0].x} ${points[0].y}`
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    const next = points[index + 1]
    const incoming = distance(previous, current)
    const outgoing = distance(current, next)
    const corner = Math.min(radius, incoming / 2, outgoing / 2)
    const before = {
      x: current.x + ((previous.x - current.x) / incoming) * corner,
      y: current.y + ((previous.y - current.y) / incoming) * corner,
    }
    const after = {
      x: current.x + ((next.x - current.x) / outgoing) * corner,
      y: current.y + ((next.y - current.y) / outgoing) * corner,
    }
    path += ` L ${before.x} ${before.y} Q ${current.x} ${current.y} ${after.x} ${after.y}`
  }

  const last = points.at(-1)!
  return `${path} L ${last.x} ${last.y}`
}

const viewForStations = (stationIds: string[], padding = 105): MapView | null => {
  const selected = stationIds.map((id) => stationById.get(id)).filter(Boolean) as Station[]
  if (selected.length === 0) return null

  const minX = Math.min(...selected.map((station) => station.mapX))
  const maxX = Math.max(...selected.map((station) => station.mapX))
  const minY = Math.min(...selected.map((station) => station.mapY))
  const maxY = Math.max(...selected.map((station) => station.mapY))
  const contentWidth = Math.max(150, maxX - minX + padding * 2)
  const contentHeight = Math.max(150, maxY - minY + padding * 2)
  const width = Math.max(contentWidth, contentHeight * MAP_ASPECT)
  const height = width / MAP_ASPECT

  return clampView({
    x: (minX + maxX) / 2 - width / 2,
    y: (minY + maxY) / 2 - height / 2,
    width,
    height,
  })
}

export const MetroMap = ({ activeStationId, routeStationIds = [], onStationClick }: Props) => {
  const { language, stationName, lineName } = useLanguage()
  const [view, setView] = useState<MapView>(FULL_VIEW)
  const [focusedLine, setFocusedLine] = useState<LineId | 'all'>('all')
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 900, height: 620 })
  const [isFullscreen, setIsFullscreen] = useState(false)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const pointersRef = useRef(new Map<number, Point>())
  const gestureMovedRef = useRef(false)
  const lastTapRef = useRef<{ at: number; point: Point } | null>(null)

  const routeKey = routeStationIds.join(':')
  const routeSet = useMemo(() => new Set(routeStationIds), [routeKey])
  const routeEndpoints = useMemo(
    () => new Set(routeStationIds.length > 0 ? [routeStationIds[0], routeStationIds.at(-1)!] : []),
    [routeKey],
  )

  const linePaths = useMemo(() => Object.values(lines).map((line) => ({
    line,
    path: roundedPath(line.stationIds.map((stationId) => {
      const station = stationById.get(stationId)!
      return { x: station.mapX, y: station.mapY }
    })),
  })), [])

  const routeSegments = useMemo(() => {
    const result = new Set<string>()
    Object.values(lines).forEach((line) => {
      line.stationIds.slice(0, -1).forEach((stationId, index) => {
        const nextId = line.stationIds[index + 1]
        if (routeSet.has(stationId) && routeSet.has(nextId)) result.add(`${stationId}:${nextId}`)
      })
    })
    return result
  }, [routeSet])

  const selectedLine = focusedLine === 'all' ? null : lines[focusedLine]
  const zoomLevel = FULL_VIEW.width / view.width
  const zoomPercent = Math.round(zoomLevel * 100)
  const renderScale = Math.max(0.1, Math.min(canvasSize.width / view.width, canvasSize.height / view.height))
  const mapPixels = (screenPixels: number) => screenPixels / renderScale

  useEffect(() => {
    const element = viewportRef.current
    if (!element || typeof ResizeObserver === 'undefined') return undefined
    const updateSize = () => setCanvasSize({
      width: Math.max(1, element.clientWidth),
      height: Math.max(1, element.clientHeight),
    })
    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFullscreen(false)
    }
    document.body.classList.toggle('map-fullscreen-open', isFullscreen)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.classList.remove('map-fullscreen-open')
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isFullscreen])

  const zoomAround = (factor: number, clientPoint?: Point) => {
    setView((current) => {
      const rect = svgRef.current?.getBoundingClientRect()
      const ratioX = rect && clientPoint ? (clientPoint.x - rect.left) / rect.width : 0.5
      const ratioY = rect && clientPoint ? (clientPoint.y - rect.top) / rect.height : 0.5
      const anchorX = current.x + ratioX * current.width
      const anchorY = current.y + ratioY * current.height
      const width = current.width / factor
      const height = width / MAP_ASPECT
      return clampView({
        x: anchorX - ratioX * width,
        y: anchorY - ratioY * height,
        width,
        height,
      })
    })
  }

  const resetMap = () => {
    setFocusedLine('all')
    setView(FULL_VIEW)
  }

  const focusLine = (lineId: LineId | 'all') => {
    setFocusedLine(lineId)
    if (lineId === 'all') {
      setView(FULL_VIEW)
      return
    }
    const next = viewForStations(lines[lineId].stationIds, 80)
    if (next) setView(next)
  }

  const focusRoute = () => {
    if (routeStationIds.length < 2) return
    const next = viewForStations(routeStationIds, 125)
    if (next) setView(next)
  }

  const handleWheel = (event: ReactWheelEvent<SVGSVGElement>) => {
    event.preventDefault()
    zoomAround(Math.exp(-event.deltaY * 0.00135), { x: event.clientX, y: event.clientY })
  }

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if ((event.target as Element).closest('.map-station')) return
    event.currentTarget.setPointerCapture(event.pointerId)
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    gestureMovedRef.current = false
  }

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return
    const before = new Map(pointersRef.current)
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const rect = event.currentTarget.getBoundingClientRect()

    if (before.size === 1) {
      const previous = before.get(event.pointerId)
      if (!previous) return
      const dx = event.clientX - previous.x
      const dy = event.clientY - previous.y
      if (Math.abs(dx) + Math.abs(dy) > 2) gestureMovedRef.current = true
      setView((current) => clampView({
        ...current,
        x: current.x - (dx / rect.width) * current.width,
        y: current.y - (dy / rect.height) * current.height,
      }))
      return
    }

    const pointerIds = [...before.keys()].slice(0, 2)
    if (pointerIds.length < 2) return
    const previousFirst = before.get(pointerIds[0])!
    const previousSecond = before.get(pointerIds[1])!
    const nextFirst = pointersRef.current.get(pointerIds[0])!
    const nextSecond = pointersRef.current.get(pointerIds[1])!
    const previousDistance = distance(previousFirst, previousSecond)
    const nextDistance = distance(nextFirst, nextSecond)
    if (previousDistance < 2 || nextDistance < 2) return

    const previousCenter = midpoint(previousFirst, previousSecond)
    const nextCenter = midpoint(nextFirst, nextSecond)
    const factor = Math.min(1.22, Math.max(0.82, nextDistance / previousDistance))
    gestureMovedRef.current = true

    setView((current) => {
      const previousRatioX = (previousCenter.x - rect.left) / rect.width
      const previousRatioY = (previousCenter.y - rect.top) / rect.height
      const nextRatioX = (nextCenter.x - rect.left) / rect.width
      const nextRatioY = (nextCenter.y - rect.top) / rect.height
      const anchorX = current.x + previousRatioX * current.width
      const anchorY = current.y + previousRatioY * current.height
      const width = current.width / factor
      const height = width / MAP_ASPECT
      return clampView({
        x: anchorX - nextRatioX * width,
        y: anchorY - nextRatioY * height,
        width,
        height,
      })
    })
  }

  const releasePointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    const point = { x: event.clientX, y: event.clientY }
    const targetIsStation = Boolean((event.target as Element).closest('.map-station'))
    pointersRef.current.delete(event.pointerId)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)

    if (event.pointerType !== 'touch' || gestureMovedRef.current || targetIsStation) return
    const now = Date.now()
    const previousTap = lastTapRef.current
    if (previousTap && now - previousTap.at < 330 && distance(previousTap.point, point) < 34) {
      zoomAround(1.45, point)
      lastTapRef.current = null
    } else {
      lastTapRef.current = { at: now, point }
    }
  }

  const lineIsDimmed = (lineId: LineId) => focusedLine !== 'all' && focusedLine !== lineId

  const shouldShowLabel = (station: Station) => {
    const important = terminalIds.has(station.id)
      || MAJOR_STATIONS.has(station.id)
      || Boolean(station.transferTo)
      || routeEndpoints.has(station.id)
      || activeStationId === station.id
    if (important) return true
    if (focusedLine === station.line) return true
    const index = lines[station.line].stationIds.indexOf(station.id)
    if (zoomLevel >= 1.75) return true
    if (zoomLevel >= 1.28) return index % 2 === 0
    return false
  }

  const nodeRadius = mapPixels(5.2)
  const routeNodeRadius = mapPixels(6.4)
  const activeNodeRadius = mapPixels(7.2)
  const transferRadius = mapPixels(10)
  const labelFontSize = mapPixels(canvasSize.width < 520 ? 11 : 12)
  const labelStrokeWidth = mapPixels(4)

  return (
    <section className={`map-card map-card-v6 card ${isFullscreen ? 'is-fullscreen' : ''}`}>
      <header className="map-header map-header-v6">
        <div>
          <span className="eyebrow">{language === 'uk' ? 'Схема метро' : 'Metro map'}</span>
          <h2>{language === 'uk' ? 'Київський метрополітен' : 'Kyiv Metro'}</h2>
          <p>{language === 'uk'
            ? 'Схема відкривається повністю. Наближення та фокус маршруту — лише за вашою дією.'
            : 'The full map opens by default. Zoom and route focus happen only when you choose them.'}</p>
        </div>
        {routeStationIds.length > 1 && (
          <button type="button" className="map-route-focus" onClick={focusRoute}>
            <Icon name="route" size={17} /> {language === 'uk' ? 'Показати маршрут' : 'Show route'}
          </button>
        )}
      </header>

      <div className="map-line-toolbar" aria-label={language === 'uk' ? 'Фільтр ліній' : 'Line filter'}>
        <button
          type="button"
          className={focusedLine === 'all' ? 'active' : ''}
          onClick={() => focusLine('all')}
          aria-pressed={focusedLine === 'all'}
        >
          {language === 'uk' ? 'Уся схема' : 'Full map'}
        </button>
        {lineIds.map((lineId) => (
          <button
            type="button"
            className={focusedLine === lineId ? 'active' : ''}
            onClick={() => focusLine(lineId)}
            aria-pressed={focusedLine === lineId}
            key={lineId}
          >
            <i style={{ background: lines[lineId].color }} />
            {lineId}
            <span>{lines[lineId].stationIds.length}</span>
          </button>
        ))}
      </div>

      <div className="map-workspace">
        <div ref={viewportRef} className="map-viewport" role="region" aria-label={language === 'uk' ? 'Інтерактивна схема метро' : 'Interactive metro map'}>
          <svg
            ref={svgRef}
            className="metro-map metro-map-v6"
            viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={language === 'uk' ? 'Схема трьох ліній Київського метро' : 'Map of the three Kyiv Metro lines'}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={releasePointer}
            onPointerCancel={releasePointer}
          >
            <rect x="0" y="0" width="960" height="710" className="diagram-background" />
            <path d="M 695 -30 C 645 85 655 185 680 270 C 713 383 652 505 690 755" className="metro-river" vectorEffect="non-scaling-stroke" />
            <text x="696" y="170" className="river-label" style={{ fontSize: mapPixels(10) }}>ДНІПРО</text>

            {linePaths.map(({ line, path }) => (
              <g key={line.id} className={lineIsDimmed(line.id) ? 'is-dimmed' : ''}>
                <path d={path} className="metro-line-halo" vectorEffect="non-scaling-stroke" />
                <path d={path} className="metro-line-base" style={{ stroke: line.color }} vectorEffect="non-scaling-stroke" />
              </g>
            ))}

            {Object.values(lines).flatMap((line) => line.stationIds.slice(0, -1).map((stationId, index) => {
              const nextId = line.stationIds[index + 1]
              if (!routeSegments.has(`${stationId}:${nextId}`)) return null
              const from = stationById.get(stationId)!
              const to = stationById.get(nextId)!
              return (
                <g key={`route-${stationId}-${nextId}`}>
                  <line x1={from.mapX} y1={from.mapY} x2={to.mapX} y2={to.mapY} className="metro-route-halo" vectorEffect="non-scaling-stroke" />
                  <line x1={from.mapX} y1={from.mapY} x2={to.mapX} y2={to.mapY} className="metro-line-active" style={{ stroke: line.color }} vectorEffect="non-scaling-stroke" />
                </g>
              )
            }))}

            {transferPairs.map(([firstId, secondId]) => {
              const first = stationById.get(firstId)!
              const second = stationById.get(secondId)!
              const active = routeSet.has(firstId) && routeSet.has(secondId)
              return (
                <g key={`${firstId}-${secondId}`}>
                  <line x1={first.mapX} y1={first.mapY} x2={second.mapX} y2={second.mapY} className="transfer-link-outline" vectorEffect="non-scaling-stroke" />
                  <line x1={first.mapX} y1={first.mapY} x2={second.mapX} y2={second.mapY} className={`transfer-link ${active ? 'active' : ''}`} vectorEffect="non-scaling-stroke" />
                </g>
              )
            })}

            {stations.map((station) => {
              const placement = labelPosition(station.id, station.line)
              const active = activeStationId === station.id
              const onRoute = routeSet.has(station.id)
              const dimmed = lineIsDimmed(station.line) && !onRoute
              const showLabel = shouldShowLabel(station)
              const radius = active ? activeNodeRadius : onRoute ? routeNodeRadius : nodeRadius
              return (
                <g
                  key={station.id}
                  className={`map-station ${active ? 'active' : ''} ${onRoute ? 'on-route' : ''} ${dimmed ? 'is-dimmed' : ''}`}
                  role="button"
                  tabIndex={dimmed ? -1 : 0}
                  aria-label={`${stationName(station)}, ${lineName(station.line)}`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => onStationClick(station.id)}
                  onKeyDown={(event) => (event.key === 'Enter' || event.key === ' ') && onStationClick(station.id)}
                >
                  {station.transferTo && (
                    <>
                      <circle cx={station.mapX} cy={station.mapY} r={transferRadius + mapPixels(2)} className="transfer-ring-outline" />
                      <circle cx={station.mapX} cy={station.mapY} r={transferRadius} className="transfer-ring" />
                    </>
                  )}
                  <circle
                    cx={station.mapX}
                    cy={station.mapY}
                    r={radius}
                    className="station-node"
                    style={{ stroke: lines[station.line].color }}
                    vectorEffect="non-scaling-stroke"
                  />
                  {showLabel && (
                    <text
                      x={station.mapX + mapPixels(placement.dx)}
                      y={station.mapY + mapPixels(placement.dy)}
                      textAnchor={placement.anchor}
                      className="station-label"
                      style={{ fontSize: labelFontSize, strokeWidth: labelStrokeWidth }}
                    >
                      {stationName(station)}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>

          <div className="map-floating-controls" aria-label={language === 'uk' ? 'Керування схемою' : 'Map controls'}>
            <button type="button" onClick={() => zoomAround(1.28)} aria-label={language === 'uk' ? 'Збільшити' : 'Zoom in'}>+</button>
            <span>{zoomPercent}%</span>
            <button type="button" onClick={() => zoomAround(0.78)} aria-label={language === 'uk' ? 'Зменшити' : 'Zoom out'}>−</button>
            <button type="button" onClick={resetMap} aria-label={language === 'uk' ? 'Показати всю схему' : 'Show full map'}><Icon name="refresh" size={18} /></button>
            <button type="button" onClick={() => setIsFullscreen((value) => !value)} aria-label={language === 'uk' ? 'Повноекранний режим' : 'Fullscreen'}>⛶</button>
          </div>

          <div className="map-gesture-hint" aria-hidden="true">
            <span>↔</span> {language === 'uk' ? 'Рухайте' : 'Pan'}
            <span>⌕</span> {language === 'uk' ? 'Наближайте' : 'Zoom'}
          </div>
        </div>

        <aside className="map-line-panel" aria-label={selectedLine ? `${lineName(selectedLine.id)}` : (language === 'uk' ? 'Лінії метро' : 'Metro lines')}>
          {selectedLine ? (
            <>
              <header>
                <span className="line-pill" style={{ background: selectedLine.color }}>{selectedLine.id}</span>
                <div>
                  <strong>{lineName(selectedLine.id)}</strong>
                  <small>{selectedLine.stationIds.length} {language === 'uk' ? 'станцій' : 'stations'}</small>
                </div>
              </header>
              <div className="map-line-stations">
                {selectedLine.stationIds.map((stationId, index) => {
                  const station = stationById.get(stationId)!
                  return (
                    <button
                      type="button"
                      className={`${activeStationId === stationId ? 'active' : ''} ${routeSet.has(stationId) ? 'on-route' : ''}`}
                      onClick={() => onStationClick(stationId)}
                      key={stationId}
                    >
                      <span className="map-line-order">{index + 1}</span>
                      <span><strong>{stationName(station)}</strong><small>{language === 'uk' ? station.nameEn : station.name}</small></span>
                      <Icon name="chevron" size={17} />
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="map-lines-overview">
              <span className="eyebrow">{language === 'uk' ? 'Швидкий огляд' : 'Quick view'}</span>
              <h3>{language === 'uk' ? 'Три лінії' : 'Three lines'}</h3>
              <p>{language === 'uk' ? 'Оберіть лінію, щоб залишити на схемі лише її та відкрити список станцій.' : 'Choose a line to isolate it on the map and open its station list.'}</p>
              {lineIds.map((lineId) => (
                <button type="button" onClick={() => focusLine(lineId)} key={lineId}>
                  <i style={{ background: lines[lineId].color }} />
                  <span><strong>{lineId} · {lineName(lineId)}</strong><small>{lines[lineId].stationIds.length} {language === 'uk' ? 'станцій' : 'stations'}</small></span>
                  <Icon name="chevron" size={18} />
                </button>
              ))}
            </div>
          )}
        </aside>
      </div>

      <footer className="map-legend map-legend-v6">
        <span className="map-tip"><Icon name="info" size={15} /> {language === 'uk' ? 'Назви з’являються поступово під час наближення, щоб не перекриватися.' : 'More labels appear as you zoom, preventing overlaps.'}</span>
      </footer>
    </section>
  )
}
