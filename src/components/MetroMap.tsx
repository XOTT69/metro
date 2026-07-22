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
import { useLanguage } from '../lib/i18n'
import type { LineId, Station } from '../types'
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

interface Point {
  x: number
  y: number
}

interface ViewTransform {
  scale: number
  x: number
  y: number
}

interface PanGesture {
  kind: 'pan'
  startView: ViewTransform
  startPoint: Point
}

interface PinchGesture {
  kind: 'pinch'
  startView: ViewTransform
  startCenter: Point
  startDistance: number
  anchorMap: Point
}

type Gesture = PanGesture | PinchGesture

const VIEWBOX_X = -35
const VIEWBOX_WIDTH = 1070
const VIEWBOX_HEIGHT = 710
const MAP_WIDTH = 1180
const MAP_HEIGHT = Math.round(MAP_WIDTH * VIEWBOX_HEIGHT / VIEWBOX_WIDTH)
const MIN_SCALE = 0.35
const MAX_SCALE = 3.5
const EDGE_ALLOWANCE = 52
const LABEL_LINE_HEIGHT = 17

const CENTRAL_LABELS = new Set([
  'teatralna',
  'khreshchatyk',
  'maidan-nezalezhnosti',
  'zoloti-vorota',
  'ploshcha-ukrainskykh-heroiv',
  'palats-sportu',
])

const LABEL_OVERRIDES: Record<string, LabelPlacement> = {
  akademmistechko: { dx: 0, dy: 27, anchor: 'middle' },
  zhytomyrska: { dx: 0, dy: -19, anchor: 'middle' },
  sviatoshyn: { dx: 0, dy: 27, anchor: 'middle' },
  nyvky: { dx: 0, dy: -19, anchor: 'middle' },
  beresteiska: { dx: 0, dy: 27, anchor: 'middle' },
  shuliavska: { dx: 0, dy: -19, anchor: 'middle' },
  'politekhnichnyi-instytut': { dx: 0, dy: 27, anchor: 'middle' },
  vokzalna: { dx: -9, dy: -20, anchor: 'end' },
  universytet: { dx: -4, dy: 28, anchor: 'middle' },
  teatralna: { dx: -21, dy: -17, anchor: 'end' },
  khreshchatyk: { dx: 22, dy: -15, anchor: 'start' },
  arsenalna: { dx: 3, dy: -20, anchor: 'middle' },
  dnipro: { dx: 0, dy: 29, anchor: 'middle' },
  hidropark: { dx: 0, dy: -20, anchor: 'middle' },
  livoberezhna: { dx: 0, dy: 29, anchor: 'middle' },
  darnytsia: { dx: 0, dy: -20, anchor: 'middle' },
  chernihivska: { dx: 0, dy: 29, anchor: 'middle' },
  lisova: { dx: 0, dy: -20, anchor: 'middle' },
  'maidan-nezalezhnosti': { dx: 22, dy: 18, anchor: 'start' },
  'ploshcha-ukrainskykh-heroiv': { dx: -23, dy: -5, anchor: 'end' },
  'zoloti-vorota': { dx: -22, dy: 24, anchor: 'end' },
  'palats-sportu': { dx: 22, dy: 22, anchor: 'start' },
  klovska: { dx: 17, dy: -14, anchor: 'start' },
  pecherska: { dx: 17, dy: -13, anchor: 'start' },
  syrets: { dx: -15, dy: -12, anchor: 'end' },
  'chervonyi-khutir': { dx: -15, dy: 27, anchor: 'end' },
}

const WRAPPED_LABELS_UK: Record<string, string[]> = {
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

const WRAPPED_LABELS_EN: Record<string, string[]> = {
  'politekhnichnyi-instytut': ['Politekhnichnyi', 'Instytut'],
  'heroiv-dnipra': ['Heroiv', 'Dnipra'],
  'tarasa-shevchenka': ['Tarasa', 'Shevchenka'],
  'kontraktova-ploshcha': ['Kontraktova', 'Ploshcha'],
  'poshtova-ploshcha': ['Poshtova', 'Ploshcha'],
  'maidan-nezalezhnosti': ['Maidan', 'Nezalezhnosti'],
  'ploshcha-ukrainskykh-heroiv': ['Ploshcha Ukrainskykh', 'Heroiv'],
  'palats-ukraina': ['Palats', 'Ukraina'],
  'vystavkovyi-tsentr': ['Vystavkovyi', 'Tsentr'],
  'zoloti-vorota': ['Zoloti', 'Vorota'],
  'palats-sportu': ['Palats', 'Sportu'],
  'chervonyi-khutir': ['Chervonyi', 'Khutir'],
}

const clampScale = (value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))

const distance = (first: Point, second: Point) => Math.hypot(first.x - second.x, first.y - second.y)

const midpoint = (first: Point, second: Point): Point => ({
  x: (first.x + second.x) / 2,
  y: (first.y + second.y) / 2,
})

const labelPosition = (stationId: string, line: LineId, order: number): LabelPlacement => {
  if (LABEL_OVERRIDES[stationId]) return LABEL_OVERRIDES[stationId]
  if (line === 'M1') {
    return order % 2 === 0
      ? { dx: 0, dy: 27, anchor: 'middle' }
      : { dx: 0, dy: -19, anchor: 'middle' }
  }
  if (line === 'M2') return { dx: -18, dy: 5, anchor: 'end' }
  return { dx: 16, dy: -11, anchor: 'start' }
}

const splitLongLabel = (name: string) => {
  if (name.length < 19 || !name.includes(' ')) return [name]
  const words = name.split(' ')
  let first = ''
  let second = ''
  words.forEach((word) => {
    if (!first || first.length <= second.length) first = `${first} ${word}`.trim()
    else second = `${second} ${word}`.trim()
  })
  return second ? [first, second] : [first]
}

const getLabelLines = (station: Station, language: 'uk' | 'en', name: string) => {
  const manual = language === 'uk' ? WRAPPED_LABELS_UK[station.id] : WRAPPED_LABELS_EN[station.id]
  return manual ?? splitLongLabel(name)
}

const estimateLabelWidth = (linesToMeasure: string[], central: boolean) => {
  const longest = Math.max(...linesToMeasure.map((line) => line.length))
  return Math.max(32, longest * (central ? 8.1 : 7.55) + 14)
}

export const MetroMap = ({ activeStationId, routeStationIds = [], onStationClick }: Props) => {
  const { language, stationName } = useLanguage()
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const pointersRef = useRef(new Map<number, Point>())
  const gestureRef = useRef<Gesture | null>(null)
  const viewRef = useRef<ViewTransform>({ scale: 0.7, x: 0, y: 0 })
  const initializedRef = useRef(false)
  const gestureMovedRef = useRef(false)
  const lastTapRef = useRef<{ time: number; point: Point } | null>(null)
  const [viewportSize, setViewportSize] = useState({ width: 1, height: 1 })
  const [view, setViewState] = useState<ViewTransform>(viewRef.current)

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

  const clampView = useCallback((candidate: ViewTransform): ViewTransform => {
    const scale = clampScale(candidate.scale)
    const scaledWidth = MAP_WIDTH * scale
    const scaledHeight = MAP_HEIGHT * scale
    const centeredX = (viewportSize.width - scaledWidth) / 2
    const centeredY = (viewportSize.height - scaledHeight) / 2
    const x = scaledWidth <= viewportSize.width
      ? centeredX
      : Math.min(EDGE_ALLOWANCE, Math.max(viewportSize.width - scaledWidth - EDGE_ALLOWANCE, candidate.x))
    const y = scaledHeight <= viewportSize.height
      ? centeredY
      : Math.min(EDGE_ALLOWANCE, Math.max(viewportSize.height - scaledHeight - EDGE_ALLOWANCE, candidate.y))
    return { scale, x, y }
  }, [viewportSize])

  const setView = useCallback((candidate: ViewTransform) => {
    const next = clampView(candidate)
    viewRef.current = next
    setViewState(next)
  }, [clampView])

  const fitMap = useCallback(() => {
    const horizontal = (viewportSize.width - 24) / MAP_WIDTH
    const vertical = (viewportSize.height - 24) / MAP_HEIGHT
    const scale = clampScale(Math.min(horizontal, vertical))
    setView({
      scale,
      x: (viewportSize.width - MAP_WIDTH * scale) / 2,
      y: (viewportSize.height - MAP_HEIGHT * scale) / 2,
    })
  }, [setView, viewportSize])

  const zoomAt = useCallback((requestedScale: number, point?: Point) => {
    const current = viewRef.current
    const scale = clampScale(requestedScale)
    const anchor = point ?? { x: viewportSize.width / 2, y: viewportSize.height / 2 }
    const mapX = (anchor.x - current.x) / current.scale
    const mapY = (anchor.y - current.y) / current.scale
    setView({
      scale,
      x: anchor.x - mapX * scale,
      y: anchor.y - mapY * scale,
    })
  }, [setView, viewportSize])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || typeof ResizeObserver === 'undefined') return
    const update = () => setViewportSize({
      width: Math.max(1, viewport.clientWidth),
      height: Math.max(1, viewport.clientHeight),
    })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (viewportSize.width <= 1 || viewportSize.height <= 1) return
    if (!initializedRef.current) {
      initializedRef.current = true
      fitMap()
      return
    }
    setView(viewRef.current)
  }, [fitMap, setView, viewportSize])

  const localPoint = (clientX: number, clientY: number): Point => {
    const rect = viewportRef.current?.getBoundingClientRect()
    return rect ? { x: clientX - rect.left, y: clientY - rect.top } : { x: clientX, y: clientY }
  }

  const beginGesture = () => {
    const points = [...pointersRef.current.values()]
    const current = viewRef.current
    if (points.length === 1) {
      gestureRef.current = { kind: 'pan', startView: current, startPoint: points[0] }
      return
    }
    if (points.length >= 2) {
      const center = midpoint(points[0], points[1])
      gestureRef.current = {
        kind: 'pinch',
        startView: current,
        startCenter: center,
        startDistance: Math.max(1, distance(points[0], points[1])),
        anchorMap: {
          x: (center.x - current.x) / current.scale,
          y: (center.y - current.y) / current.scale,
        },
      }
    }
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest('.map-station')) return
    event.currentTarget.setPointerCapture(event.pointerId)
    pointersRef.current.set(event.pointerId, localPoint(event.clientX, event.clientY))
    gestureMovedRef.current = false
    beginGesture()
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return
    pointersRef.current.set(event.pointerId, localPoint(event.clientX, event.clientY))
    const gesture = gestureRef.current
    if (!gesture) return

    const points = [...pointersRef.current.values()]
    if (gesture.kind === 'pan' && points.length === 1) {
      const dx = points[0].x - gesture.startPoint.x
      const dy = points[0].y - gesture.startPoint.y
      if (Math.abs(dx) + Math.abs(dy) > 3) gestureMovedRef.current = true
      setView({
        scale: gesture.startView.scale,
        x: gesture.startView.x + dx,
        y: gesture.startView.y + dy,
      })
      return
    }

    if (points.length >= 2) {
      if (gesture.kind !== 'pinch') {
        beginGesture()
        return
      }
      const center = midpoint(points[0], points[1])
      const nextDistance = Math.max(1, distance(points[0], points[1]))
      const scale = clampScale(gesture.startView.scale * (nextDistance / gesture.startDistance))
      gestureMovedRef.current = true
      setView({
        scale,
        x: center.x - gesture.anchorMap.x * scale,
        y: center.y - gesture.anchorMap.y * scale,
      })
    }
  }

  const releasePointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const point = localPoint(event.clientX, event.clientY)
    pointersRef.current.delete(event.pointerId)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)

    if (!gestureMovedRef.current && event.pointerType === 'touch') {
      const now = Date.now()
      const previous = lastTapRef.current
      if (previous && now - previous.time < 330 && distance(previous.point, point) < 34) {
        zoomAt(viewRef.current.scale * 1.55, point)
        lastTapRef.current = null
      } else {
        lastTapRef.current = { time: now, point }
      }
    }

    gestureRef.current = null
    if (pointersRef.current.size) beginGesture()
  }

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const point = localPoint(event.clientX, event.clientY)
    zoomAt(viewRef.current.scale * Math.exp(-event.deltaY * 0.0015), point)
  }

  return (
    <section className="map-card map-viewer-card card">
      <header className="map-header map-viewer-header">
        <div>
          <span className="eyebrow">{language === 'uk' ? 'Інтерактивна схема' : 'Interactive map'}</span>
          <h2>{language === 'uk' ? 'Київський метрополітен' : 'Kyiv Metro'}</h2>
          <p>{language === 'uk' ? 'Рухайте одним пальцем, масштабуйте двома.' : 'Pan with one finger and pinch with two.'}</p>
        </div>
        <button type="button" className="map-fit-button" onClick={fitMap}>
          <Icon name="refresh" size={17} />
          {language === 'uk' ? 'Уся схема' : 'Fit map'}
        </button>
      </header>

      <div
        ref={viewportRef}
        className="map-panzoom-viewport map-scroll-pinch"
        role="region"
        aria-label={language === 'uk' ? 'Інтерактивна схема метро' : 'Interactive metro map'}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={releasePointer}
        onPointerCancel={releasePointer}
        onWheel={handleWheel}
        onDoubleClick={(event) => zoomAt(viewRef.current.scale * 1.45, localPoint(event.clientX, event.clientY))}
      >
        <div
          className="map-panzoom-canvas"
          style={{
            width: `${MAP_WIDTH}px`,
            height: `${MAP_HEIGHT}px`,
            transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`,
          }}
        >
          <svg
            className="metro-map metro-map-v130"
            viewBox={`${VIEWBOX_X} 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
            role="img"
            aria-label={language === 'uk' ? 'Схема трьох ліній Київського метро' : 'Map of the three Kyiv Metro lines'}
          >
            <rect x={VIEWBOX_X} y="0" width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} className="map-paper" />
            <path d="M 590 -30 C 620 120 585 245 610 350 C 635 465 600 590 625 750" className="metro-river-v130" />

            {Object.values(lines).map((line) => {
              const points = line.stationIds
                .map((stationId) => stationById.get(stationId))
                .filter(Boolean)
                .map((station) => `${station!.mapX},${station!.mapY}`)
                .join(' ')
              return (
                <g key={line.id}>
                  <polyline points={points} className="metro-line-halo-v130" />
                  <polyline points={points} className="metro-line-base metro-line-v130" style={{ stroke: line.color }} />
                </g>
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
                    className="metro-line-active metro-line-active-v130"
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
                <g key={`${a}-${b}`}>
                  <line
                    x1={first.mapX}
                    y1={first.mapY}
                    x2={second.mapX}
                    y2={second.mapY}
                    className="transfer-link-halo-v130"
                  />
                  <line
                    x1={first.mapX}
                    y1={first.mapY}
                    x2={second.mapX}
                    y2={second.mapY}
                    className={`transfer-link transfer-link-v130 ${active ? 'active' : ''}`}
                  />
                </g>
              )
            })}

            {stations.map((station) => {
              const placement = labelPosition(station.id, station.line, station.order)
              const name = stationName(station)
              const labelLines = getLabelLines(station, language, name)
              const labelX = station.mapX + placement.dx
              const labelY = station.mapY + placement.dy - (placement.dy < 0 ? (labelLines.length - 1) * LABEL_LINE_HEIGHT : 0)
              const central = CENTRAL_LABELS.has(station.id)
              const plateWidth = estimateLabelWidth(labelLines, central)
              const plateHeight = labelLines.length * LABEL_LINE_HEIGHT + 8
              const plateX = placement.anchor === 'start'
                ? labelX - 6
                : placement.anchor === 'end'
                  ? labelX - plateWidth + 6
                  : labelX - plateWidth / 2
              const plateY = labelY - 14
              const active = activeStationId === station.id
              const onRoute = routeSet.has(station.id)

              return (
                <g
                  key={station.id}
                  className={`map-station ${active ? 'active' : ''} ${onRoute ? 'on-route' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-label={name}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => onStationClick(station.id)}
                  onKeyDown={(event) => (event.key === 'Enter' || event.key === ' ') && onStationClick(station.id)}
                >
                  <rect
                    x={plateX}
                    y={plateY}
                    width={plateWidth}
                    height={plateHeight}
                    rx="5"
                    className={`station-label-plate ${central ? 'station-label-plate-central' : ''}`}
                  />
                  {station.transferTo && <circle cx={station.mapX} cy={station.mapY} r="11" className="transfer-ring transfer-ring-v130" />}
                  <circle
                    cx={station.mapX}
                    cy={station.mapY}
                    r={active ? 8.5 : onRoute ? 7 : 5.5}
                    className="station-node station-node-v130"
                    style={{ stroke: lines[station.line].color }}
                  />
                  <text
                    x={labelX}
                    y={labelY}
                    textAnchor={placement.anchor}
                    className={`station-label station-label-v130 ${central ? 'station-label-central-v130' : ''}`}
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

        <div className="map-viewer-controls" aria-label={language === 'uk' ? 'Масштаб схеми' : 'Map zoom'}>
          <button type="button" onClick={() => zoomAt(viewRef.current.scale * 1.25)} aria-label={language === 'uk' ? 'Збільшити схему' : 'Zoom in'}>+</button>
          <span>{Math.round(view.scale * 100)}%</span>
          <button type="button" onClick={() => zoomAt(viewRef.current.scale / 1.25)} aria-label={language === 'uk' ? 'Зменшити схему' : 'Zoom out'}>−</button>
          <button type="button" onClick={fitMap} aria-label={language === 'uk' ? 'Показати всю схему' : 'Fit full map'}>
            <Icon name="refresh" size={18} />
          </button>
        </div>

        <div className="map-viewer-hint" aria-hidden="true">
          <span>↔</span>{language === 'uk' ? 'рух' : 'pan'}
          <span>⌕</span>{language === 'uk' ? 'масштаб' : 'zoom'}
        </div>
      </div>

      <footer className="map-legend map-legend-v130">
        {Object.values(lines).map((line) => (
          <span key={line.id}><i style={{ background: line.color }} /> {line.id}</span>
        ))}
        <span className="map-tip"><Icon name="info" size={15} /> {language === 'uk' ? 'Натисніть станцію для деталей' : 'Tap a station for details'}</span>
      </footer>
    </section>
  )
}
