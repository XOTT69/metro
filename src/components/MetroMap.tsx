import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import { lines, stationById, stations, transferPairs } from '../data/metro'
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

const FULL_VIEW: MapView = { x: 25, y: 10, width: 910, height: 690 }
const MAP_BOUNDS = { x: 0, y: 0, width: 960, height: 710 }
const MAP_ASPECT = FULL_VIEW.width / FULL_VIEW.height
const MIN_VIEW_WIDTH = 225
const MAX_VIEW_WIDTH = 1080
const lineIds: LineId[] = ['M1', 'M2', 'M3']

const labelPosition = (stationId: string, line: LineId) => {
  const below = new Set([
    'akademmistechko', 'zhytomyrska', 'sviatoshyn', 'nyvky', 'beresteiska', 'shuliavska',
    'politekhnichnyi-instytut', 'vokzalna', 'universytet', 'arsenalna', 'dnipro', 'hidropark',
    'livoberezhna', 'darnytsia', 'chernihivska', 'lisova', 'heroiv-dnipra', 'minska', 'obolon',
    'pochaina', 'tarasa-shevchenka', 'kontraktova-ploshcha', 'poshtova-ploshcha',
  ])
  if (line === 'M2' && !below.has(stationId)) return { dx: -13, dy: 4, anchor: 'end' as const }
  if (line === 'M3') return { dx: 10, dy: -8, anchor: 'start' as const }
  return { dx: 0, dy: 20, anchor: 'middle' as const }
}

const constrainAxis = (value: number, size: number, boundsStart: number, boundsSize: number) => {
  const overscroll = Math.min(55, size * 0.08)
  const minimum = boundsStart - overscroll
  const maximum = boundsStart + boundsSize - size + overscroll
  if (minimum > maximum) return boundsStart + (boundsSize - size) / 2
  return Math.min(maximum, Math.max(minimum, value))
}

const clampView = (view: MapView): MapView => {
  const width = Math.min(MAX_VIEW_WIDTH, Math.max(MIN_VIEW_WIDTH, view.width))
  const height = width / MAP_ASPECT
  return {
    x: constrainAxis(view.x, width, MAP_BOUNDS.x, MAP_BOUNDS.width),
    y: constrainAxis(view.y, height, MAP_BOUNDS.y, MAP_BOUNDS.height),
    width,
    height,
  }
}

const distance = (first: Point, second: Point) => Math.hypot(first.x - second.x, first.y - second.y)
const midpoint = (first: Point, second: Point): Point => ({ x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 })

const boundsForStations = (stationIds: string[], padding = 70): MapView | null => {
  const selected = stationIds.map((id) => stationById.get(id)).filter(Boolean) as Station[]
  if (selected.length === 0) return null

  const minX = Math.min(...selected.map((station) => station.mapX))
  const maxX = Math.max(...selected.map((station) => station.mapX))
  const minY = Math.min(...selected.map((station) => station.mapY))
  const maxY = Math.max(...selected.map((station) => station.mapY))
  const contentWidth = Math.max(90, maxX - minX + padding * 2)
  const contentHeight = Math.max(90, maxY - minY + padding * 2)
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
  const [view, setView] = useState<MapView>(FULL_VIEW)
  const [focusedLine, setFocusedLine] = useState<LineId | 'all'>('all')
  const svgRef = useRef<SVGSVGElement | null>(null)
  const pointersRef = useRef(new Map<number, Point>())
  const gestureMovedRef = useRef(false)

  const routeKey = routeStationIds.join(':')
  const routeSet = useMemo(() => new Set(routeStationIds), [routeKey])
  const zoomPercent = Math.round((FULL_VIEW.width / view.width) * 100)
  const selectedLine = focusedLine === 'all' ? null : lines[focusedLine]

  const activeLineSegments = useMemo(() => {
    const result = new Set<string>()
    Object.values(lines).forEach((line) => {
      line.stationIds.forEach((stationId, index) => {
        const next = line.stationIds[index + 1]
        if (next && routeSet.has(stationId) && routeSet.has(next)) result.add(`${stationId}:${next}`)
      })
    })
    return result
  }, [routeSet])

  const focusStations = useCallback((stationIds: string[], padding?: number) => {
    const next = boundsForStations(stationIds, padding)
    if (next) setView(next)
  }, [])

  const resetMap = useCallback(() => {
    setFocusedLine('all')
    setView(FULL_VIEW)
  }, [])

  const focusLine = useCallback((lineId: LineId | 'all') => {
    setFocusedLine(lineId)
    if (lineId === 'all') setView(FULL_VIEW)
    else focusStations(lines[lineId].stationIds, 60)
  }, [focusStations])

  const focusStation = useCallback((stationId: string) => {
    focusStations([stationId], 105)
  }, [focusStations])

  const focusRoute = useCallback(() => {
    if (routeStationIds.length > 1) focusStations(routeStationIds, 75)
  }, [focusStations, routeKey])

  const zoomAround = useCallback((factor: number, clientPoint?: Point) => {
    setView((current) => {
      const rect = svgRef.current?.getBoundingClientRect()
      const ratioX = rect && clientPoint ? (clientPoint.x - rect.left) / rect.width : 0.5
      const ratioY = rect && clientPoint ? (clientPoint.y - rect.top) / rect.height : 0.5
      const anchorX = current.x + ratioX * current.width
      const anchorY = current.y + ratioY * current.height
      const nextWidth = current.width / factor
      const nextHeight = nextWidth / MAP_ASPECT
      return clampView({
        x: anchorX - ratioX * nextWidth,
        y: anchorY - ratioY * nextHeight,
        width: nextWidth,
        height: nextHeight,
      })
    })
  }, [])

  useEffect(() => {
    if (routeStationIds.length > 1) focusRoute()
  }, [routeKey, focusRoute])

  useEffect(() => {
    if (activeStationId && stationById.has(activeStationId)) focusStation(activeStationId)
  }, [activeStationId, focusStation])

  const handleWheel = (event: ReactWheelEvent<SVGSVGElement>) => {
    event.preventDefault()
    zoomAround(Math.exp(-event.deltaY * 0.0015), { x: event.clientX, y: event.clientY })
  }

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    const target = event.target as Element
    if (target.closest('.map-station')) return
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
      if (Math.abs(dx) + Math.abs(dy) > 1) gestureMovedRef.current = true
      setView((current) => clampView({
        ...current,
        x: current.x - (dx / rect.width) * current.width,
        y: current.y - (dy / rect.height) * current.height,
      }))
      return
    }

    if (before.size >= 2) {
      const pointerIds = [...before.keys()].slice(0, 2)
      const previousFirst = before.get(pointerIds[0])!
      const previousSecond = before.get(pointerIds[1])!
      const nextFirst = pointersRef.current.get(pointerIds[0])!
      const nextSecond = pointersRef.current.get(pointerIds[1])!
      const previousDistance = distance(previousFirst, previousSecond)
      const nextDistance = distance(nextFirst, nextSecond)
      if (previousDistance < 2 || nextDistance < 2) return

      const previousCenter = midpoint(previousFirst, previousSecond)
      const nextCenter = midpoint(nextFirst, nextSecond)
      const factor = Math.min(1.25, Math.max(0.8, nextDistance / previousDistance))
      gestureMovedRef.current = true

      setView((current) => {
        const previousRatioX = (previousCenter.x - rect.left) / rect.width
        const previousRatioY = (previousCenter.y - rect.top) / rect.height
        const nextRatioX = (nextCenter.x - rect.left) / rect.width
        const nextRatioY = (nextCenter.y - rect.top) / rect.height
        const anchorX = current.x + previousRatioX * current.width
        const anchorY = current.y + previousRatioY * current.height
        const nextWidth = current.width / factor
        const nextHeight = nextWidth / MAP_ASPECT
        return clampView({
          x: anchorX - nextRatioX * nextWidth,
          y: anchorY - nextRatioY * nextHeight,
          width: nextWidth,
          height: nextHeight,
        })
      })
    }
  }

  const releasePointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    pointersRef.current.delete(event.pointerId)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const openStation = (stationId: string) => {
    if (gestureMovedRef.current) return
    focusStation(stationId)
    onStationClick(stationId)
  }

  const lineIsDimmed = (lineId: LineId) => focusedLine !== 'all' && focusedLine !== lineId

  return (
    <section className="map-card map-card-v6 card">
      <header className="map-header map-header-v6">
        <div>
          <span className="eyebrow">Інтерактивна схема</span>
          <h2>Київський метрополітен</h2>
          <p>Перетягуйте схему, масштабуйте колесом або двома пальцями.</p>
        </div>
        <div className="map-header-actions">
          {routeStationIds.length > 1 && (
            <button type="button" className="map-route-focus" onClick={focusRoute}>
              <Icon name="route" size={17} /> Маршрут
            </button>
          )}
          <div className="zoom-controls" aria-label="Масштаб карти">
            <button type="button" onClick={() => zoomAround(0.8)} aria-label="Зменшити">−</button>
            <span>{zoomPercent}%</span>
            <button type="button" onClick={() => zoomAround(1.25)} aria-label="Збільшити">+</button>
          </div>
          <button type="button" className="map-reset-button" onClick={resetMap} aria-label="Показати всю схему" title="Показати всю схему">
            <Icon name="refresh" size={18} />
          </button>
        </div>
      </header>

      <div className="map-line-toolbar" aria-label="Фільтр ліній">
        <button type="button" className={focusedLine === 'all' ? 'active' : ''} onClick={() => focusLine('all')} aria-pressed={focusedLine === 'all'}>
          Усі лінії
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

      <div className={`map-workspace ${selectedLine ? 'has-line-list' : ''}`}>
        <div className="map-viewport" role="region" aria-label="Схема метро з масштабуванням і переміщенням">
          <svg
            ref={svgRef}
            className={`metro-map metro-map-v6 ${gestureMovedRef.current ? 'is-dragging' : ''}`}
            viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
            role="img"
            aria-label="Схема трьох ліній Київського метро"
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={releasePointer}
            onPointerCancel={releasePointer}
          >
            <g className="map-grid" aria-hidden="true">
              {Array.from({ length: 10 }).map((_, index) => <line key={`v-${index}`} x1={50 + index * 95} x2={50 + index * 95} y1="20" y2="680" />)}
              {Array.from({ length: 8 }).map((_, index) => <line key={`h-${index}`} x1="35" x2="925" y1={35 + index * 90} y2={35 + index * 90} />)}
            </g>

            {Object.values(lines).map((line) => {
              const points = line.stationIds
                .map((stationId) => stationById.get(stationId))
                .filter(Boolean)
                .map((station) => `${station!.mapX},${station!.mapY}`)
                .join(' ')
              return (
                <polyline
                  key={line.id}
                  points={points}
                  className={`metro-line-base ${lineIsDimmed(line.id) ? 'is-dimmed' : ''}`}
                  style={{ stroke: line.color }}
                />
              )
            })}

            {Object.values(lines).flatMap((line) =>
              line.stationIds.slice(0, -1).map((stationId, index) => {
                const nextId = line.stationIds[index + 1]
                if (!activeLineSegments.has(`${stationId}:${nextId}`)) return null
                const from = stationById.get(stationId)!
                const to = stationById.get(nextId)!
                return (
                  <line
                    key={`active-${stationId}-${nextId}`}
                    x1={from.mapX}
                    y1={from.mapY}
                    x2={to.mapX}
                    y2={to.mapY}
                    className="metro-line-active"
                    style={{ stroke: line.color }}
                  />
                )
              }),
            )}

            {transferPairs.map(([a, b]) => {
              const first = stationById.get(a)!
              const second = stationById.get(b)!
              const active = routeSet.has(a) && routeSet.has(b)
              const dimmed = focusedLine !== 'all' && focusedLine !== first.line && focusedLine !== second.line && !active
              return (
                <line
                  key={`${a}-${b}`}
                  x1={first.mapX}
                  y1={first.mapY}
                  x2={second.mapX}
                  y2={second.mapY}
                  className={`transfer-link ${active ? 'active' : ''} ${dimmed ? 'is-dimmed' : ''}`}
                />
              )
            })}

            {stations.map((station) => {
              const label = labelPosition(station.id, station.line)
              const active = activeStationId === station.id
              const onRoute = routeSet.has(station.id)
              const dimmed = lineIsDimmed(station.line) && !onRoute
              return (
                <g
                  key={station.id}
                  className={`map-station ${active ? 'active' : ''} ${onRoute ? 'on-route' : ''} ${dimmed ? 'is-dimmed' : ''}`}
                  role="button"
                  tabIndex={dimmed ? -1 : 0}
                  aria-label={`${station.name}, ${lines[station.line].name}`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => openStation(station.id)}
                  onKeyDown={(event) => (event.key === 'Enter' || event.key === ' ') && openStation(station.id)}
                >
                  {station.transferTo && <circle cx={station.mapX} cy={station.mapY} r="10" className="transfer-ring" />}
                  <circle cx={station.mapX} cy={station.mapY} r={active ? 8 : onRoute ? 6.5 : 5.2} className="station-node" style={{ stroke: lines[station.line].color }} />
                  <text x={station.mapX + label.dx} y={station.mapY + label.dy} textAnchor={label.anchor} className="station-label">
                    {station.name}
                  </text>
                </g>
              )
            })}
          </svg>

          <div className="map-gesture-hint" aria-hidden="true">
            <span>↔</span> Рухайте
            <span>⌕</span> Масштабуйте
          </div>
        </div>

        <aside className="map-line-panel" aria-label={selectedLine ? `Станції лінії ${selectedLine.id}` : 'Лінії метро'}>
          {selectedLine ? (
            <>
              <header>
                <span className="line-pill" style={{ background: selectedLine.color }}>{selectedLine.id}</span>
                <div>
                  <strong>{selectedLine.name}</strong>
                  <small>{selectedLine.stationIds.length} станцій · {selectedLine.terminalStart} — {selectedLine.terminalEnd}</small>
                </div>
              </header>
              <div className="map-line-stations">
                {selectedLine.stationIds.map((stationId, index) => {
                  const station = stationById.get(stationId)!
                  const isActive = activeStationId === stationId
                  const isOnRoute = routeSet.has(stationId)
                  return (
                    <button
                      type="button"
                      className={`${isActive ? 'active' : ''} ${isOnRoute ? 'on-route' : ''}`}
                      onClick={() => {
                        focusStation(stationId)
                        onStationClick(stationId)
                      }}
                      key={stationId}
                    >
                      <span className="map-line-order">{index + 1}</span>
                      <span>
                        <strong>{station.name}</strong>
                        <small>{station.nameEn}{station.transferTo ? ' · пересадка' : ''}</small>
                      </span>
                      {station.transferTo && <Icon name="refresh" size={15} />}
                      <Icon name="chevron" size={17} />
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="map-lines-overview">
              <span className="eyebrow">Навігація схемою</span>
              <h3>Оберіть лінію</h3>
              <p>Схема сфокусується на ній, а поруч відкриється послідовний список станцій.</p>
              {lineIds.map((lineId) => (
                <button type="button" onClick={() => focusLine(lineId)} key={lineId}>
                  <i style={{ background: lines[lineId].color }} />
                  <span><strong>{lineId} · {lines[lineId].name}</strong><small>{lines[lineId].terminalStart} — {lines[lineId].terminalEnd}</small></span>
                  <Icon name="chevron" size={18} />
                </button>
              ))}
            </div>
          )}
        </aside>
      </div>

      <footer className="map-legend map-legend-v6">
        {Object.values(lines).map((line) => (
          <button type="button" onClick={() => focusLine(line.id)} key={line.id}><i style={{ background: line.color }} /> {line.id}</button>
        ))}
        <span className="map-tip"><Icon name="info" size={15} /> Торкніться станції, щоб відкрити деталі</span>
      </footer>
    </section>
  )
}
