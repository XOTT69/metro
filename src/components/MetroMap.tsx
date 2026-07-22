import {
  useMemo,
  useRef,
  useState,
  type TouchEvent as ReactTouchEvent,
} from 'react'
import { lines, stationById, stations, transferPairs } from '../data/metro'
import type { LineId } from '../types'
import { Icon } from './Icon'

interface Props {
  activeStationId?: string
  routeStationIds?: string[]
  onStationClick: (stationId: string) => void
}

interface LabelPlacement {
  dx: number
  dy: number
  anchor: 'start' | 'middle' | 'end'
}

interface PinchState {
  startDistance: number
  startZoom: number
  localX: number
  localY: number
  contentX: number
  contentY: number
}

interface TouchPoint {
  clientX: number
  clientY: number
}

const MIN_ZOOM = 0.5
const MAX_ZOOM = 2.4
const BASE_MAP_WIDTH = 1000
const LABEL_LINE_HEIGHT = 12

const CENTRAL_LABELS = new Set([
  'teatralna',
  'khreshchatyk',
  'maidan-nezalezhnosti',
  'zoloti-vorota',
  'ploshcha-ukrainskykh-heroiv',
  'palats-sportu',
])

const LABEL_OVERRIDES: Record<string, LabelPlacement> = {
  teatralna: { dx: -17, dy: -13, anchor: 'end' },
  khreshchatyk: { dx: 17, dy: -11, anchor: 'start' },
  arsenalna: { dx: 0, dy: -15, anchor: 'middle' },
  dnipro: { dx: 0, dy: 23, anchor: 'middle' },
  'maidan-nezalezhnosti': { dx: 18, dy: 13, anchor: 'start' },
  'ploshcha-ukrainskykh-heroiv': { dx: -18, dy: -3, anchor: 'end' },
  'zoloti-vorota': { dx: -17, dy: 21, anchor: 'end' },
  'palats-sportu': { dx: 18, dy: 18, anchor: 'start' },
  klovska: { dx: 14, dy: -12, anchor: 'start' },
  pecherska: { dx: 14, dy: -11, anchor: 'start' },
  syrets: { dx: -12, dy: -10, anchor: 'end' },
  'chervonyi-khutir': { dx: -12, dy: 22, anchor: 'end' },
}

const WRAPPED_LABELS: Record<string, string[]> = {
  'politekhnichnyi-instytut': ['Політехнічний', 'інститут'],
  'heroiv-dnipra': ['Героїв', 'Дніпра'],
  'tarasa-shevchenka': ['Тараса', 'Шевченка'],
  'kontraktova-ploshcha': ['Контрактова', 'площа'],
  'poshtova-ploshcha': ['Поштова', 'площа'],
  'maidan-nezalezhnosti': ['Майдан', 'Незалежності'],
  'ploshcha-ukrainskykh-heroiv': ['Площа Українських', 'Героїв'],
  'palats-ukraina': ['Палац', '«Україна»'],
  'vystavkovyi-tsentr': ['Виставковий', 'центр'],
  'zoloti-vorota': ['Золоті', 'ворота'],
  'palats-sportu': ['Палац', 'спорту'],
  'chervonyi-khutir': ['Червоний', 'хутір'],
}

const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))

const labelPosition = (stationId: string, line: LineId, order: number): LabelPlacement => {
  if (LABEL_OVERRIDES[stationId]) return LABEL_OVERRIDES[stationId]

  if (line === 'M1') {
    return order % 2 === 0
      ? { dx: 0, dy: 23, anchor: 'middle' }
      : { dx: 0, dy: -14, anchor: 'middle' }
  }

  if (line === 'M2') return { dx: -14, dy: 4, anchor: 'end' }
  return { dx: 12, dy: -9, anchor: 'start' }
}

const touchDistance = (first: TouchPoint, second: TouchPoint) => Math.hypot(
  first.clientX - second.clientX,
  first.clientY - second.clientY,
)

export const MetroMap = ({ activeStationId, routeStationIds = [], onStationClick }: Props) => {
  const [zoom, setZoom] = useState(1)
  const mapScrollRef = useRef<HTMLDivElement | null>(null)
  const pinchRef = useRef<PinchState | null>(null)
  const routeSet = useMemo(() => new Set(routeStationIds), [routeStationIds])
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

  const changeZoom = (change: number) => {
    setZoom((value) => Math.round(clampZoom(value + change) * 100) / 100)
  }

  const handleTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2) return
    const container = mapScrollRef.current
    if (!container) return

    event.preventDefault()
    const first = event.touches[0]
    const second = event.touches[1]
    const rect = container.getBoundingClientRect()
    const localX = (first.clientX + second.clientX) / 2 - rect.left
    const localY = (first.clientY + second.clientY) / 2 - rect.top

    pinchRef.current = {
      startDistance: touchDistance(first, second),
      startZoom: zoom,
      localX,
      localY,
      contentX: container.scrollLeft + localX,
      contentY: container.scrollTop + localY,
    }
  }

  const handleTouchMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2 || !pinchRef.current) return
    const container = mapScrollRef.current
    if (!container) return

    event.preventDefault()
    const pinch = pinchRef.current
    const nextDistance = touchDistance(event.touches[0], event.touches[1])
    if (pinch.startDistance < 1) return

    const nextZoom = clampZoom(pinch.startZoom * (nextDistance / pinch.startDistance))
    const scaleRatio = nextZoom / pinch.startZoom
    setZoom(nextZoom)

    requestAnimationFrame(() => {
      container.scrollLeft = pinch.contentX * scaleRatio - pinch.localX
      container.scrollTop = pinch.contentY * scaleRatio - pinch.localY
    })
  }

  const handleTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (event.touches.length < 2) pinchRef.current = null
  }

  return (
    <section className="map-card card">
      <header className="map-header">
        <div>
          <span className="eyebrow">Інтерактивна схема</span>
          <h2>Київський метрополітен</h2>
        </div>
        <div className="zoom-controls" aria-label="Масштаб карти">
          <button type="button" onClick={() => changeZoom(-0.15)} aria-label="Зменшити">−</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => changeZoom(0.15)} aria-label="Збільшити">+</button>
        </div>
      </header>
      <div
        ref={mapScrollRef}
        className="map-scroll map-scroll-pinch"
        role="region"
        aria-label="Схема метро. Масштабуйте двома пальцями або кнопками"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <svg
          className="metro-map"
          viewBox="0 0 1000 710"
          style={{ width: `${BASE_MAP_WIDTH * zoom}px` }}
          role="img"
          aria-label="Схема трьох ліній Київського метро"
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
            return <polyline key={line.id} points={points} className="metro-line-base" style={{ stroke: line.color }} />
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
            return (
              <line
                key={`${a}-${b}`}
                x1={first.mapX}
                y1={first.mapY}
                x2={second.mapX}
                y2={second.mapY}
                className={`transfer-link ${active ? 'active' : ''}`}
              />
            )
          })}

          {stations.map((station) => {
            const label = labelPosition(station.id, station.line, station.order)
            const labelLines = WRAPPED_LABELS[station.id] ?? [station.name]
            const labelX = station.mapX + label.dx
            const labelY = station.mapY + label.dy - (label.dy < 0 ? (labelLines.length - 1) * LABEL_LINE_HEIGHT : 0)
            const active = activeStationId === station.id
            const onRoute = routeSet.has(station.id)
            return (
              <g
                key={station.id}
                className={`map-station ${active ? 'active' : ''} ${onRoute ? 'on-route' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={station.name}
                onClick={() => onStationClick(station.id)}
                onKeyDown={(event) => (event.key === 'Enter' || event.key === ' ') && onStationClick(station.id)}
              >
                {station.transferTo && <circle cx={station.mapX} cy={station.mapY} r="10" className="transfer-ring" />}
                <circle cx={station.mapX} cy={station.mapY} r={active ? 8 : onRoute ? 6.5 : 5.2} className="station-node" style={{ stroke: lines[station.line].color }} />
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor={label.anchor}
                  className={`station-label ${CENTRAL_LABELS.has(station.id) ? 'station-label-central' : ''}`}
                >
                  {labelLines.map((line, index) => (
                    <tspan key={`${station.id}-${index}`} x={labelX} dy={index === 0 ? 0 : LABEL_LINE_HEIGHT}>
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <footer className="map-legend">
        {Object.values(lines).map((line) => (
          <span key={line.id}><i style={{ background: line.color }} /> {line.id}</span>
        ))}
        <span className="map-tip"><Icon name="info" size={15} /> Два пальці — масштаб</span>
      </footer>
    </section>
  )
}
