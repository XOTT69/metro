import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import { lines, stations, transferPairs } from '../data/metro'
import { useLanguage } from '../lib/i18n'
import type { Station } from '../types'
import { Icon } from './Icon'
import {
  LINE_BADGES,
  MAP_BOUNDS,
  RIVER_PATH,
  placementForStation,
  pointForStation,
  pointsForLine,
  roundedPath,
  type MapPoint,
} from './metroMapSchematic'

interface Props {
  activeStationId?: string
  routeStationIds?: string[]
  onStationClick: (stationId: string) => void
}

interface ViewBox {
  x: number
  y: number
  width: number
  height: number
}

interface PanGesture {
  kind: 'pan'
  startView: ViewBox
  startPoint: MapPoint
}

interface PinchGesture {
  kind: 'pinch'
  startView: ViewBox
  startCenter: MapPoint
  startDistance: number
  anchorMap: MapPoint
}

type Gesture = PanGesture | PinchGesture

const FIT_PADDING = 24
const MIN_VIEW_WIDTH = 250
const LABEL_LINE_HEIGHT = 17

const CENTRAL_LABELS = new Set([
  'teatralna',
  'khreshchatyk',
  'maidan-nezalezhnosti',
  'zoloti-vorota',
  'ploshcha-ukrainskykh-heroiv',
  'palats-sportu',
])

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

const distance = (first: MapPoint, second: MapPoint) => Math.hypot(first.x - second.x, first.y - second.y)

const midpoint = (first: MapPoint, second: MapPoint): MapPoint => ({
  x: (first.x + second.x) / 2,
  y: (first.y + second.y) / 2,
})

const balancedWrap = (name: string) => {
  if (name.length < 19 || !name.includes(' ')) return [name]
  const words = name.split(' ')
  let best: string[] = [name]
  let bestScore = Number.POSITIVE_INFINITY

  for (let splitAt = 1; splitAt < words.length; splitAt += 1) {
    const first = words.slice(0, splitAt).join(' ')
    const second = words.slice(splitAt).join(' ')
    const score = Math.max(first.length, second.length) * 2 + Math.abs(first.length - second.length)
    if (score < bestScore) {
      best = [first, second]
      bestScore = score
    }
  }

  return best
}

const labelLines = (station: Station, language: 'uk' | 'en', name: string) => {
  const manual = language === 'uk' ? WRAPPED_LABELS_UK[station.id] : WRAPPED_LABELS_EN[station.id]
  return manual ?? balancedWrap(name)
}

const fitViewForViewport = (viewport: { width: number; height: number }): ViewBox => {
  const aspect = viewport.width / viewport.height
  const contentWidth = MAP_BOUNDS.width + FIT_PADDING * 2
  const contentHeight = MAP_BOUNDS.height + FIT_PADDING * 2
  const contentAspect = contentWidth / contentHeight
  const width = contentAspect > aspect ? contentWidth : contentHeight * aspect
  const height = width / aspect

  return {
    x: MAP_BOUNDS.x + MAP_BOUNDS.width / 2 - width / 2,
    y: MAP_BOUNDS.y + MAP_BOUNDS.height / 2 - height / 2,
    width,
    height,
  }
}

const readableViewForViewport = (viewport: { width: number; height: number }): ViewBox => {
  const fit = fitViewForViewport(viewport)
  const aspect = viewport.width / viewport.height
  const targetWidth = aspect < 0.9
    ? Math.min(fit.width, viewport.width <= 430 ? 740 : 800)
    : Math.min(fit.width, 1060)
  const targetHeight = targetWidth / aspect
  const center = aspect < 0.9 ? { x: 535, y: 630 } : { x: 520, y: 650 }

  return {
    x: center.x - targetWidth / 2,
    y: center.y - targetHeight / 2,
    width: targetWidth,
    height: targetHeight,
  }
}

export const MetroMap = ({ activeStationId, routeStationIds = [], onStationClick }: Props) => {
  const { language, stationName } = useLanguage()
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const pointersRef = useRef(new Map<number, MapPoint>())
  const gestureRef = useRef<Gesture | null>(null)
  const viewRef = useRef<ViewBox>({ ...MAP_BOUNDS })
  const initializedRef = useRef(false)
  const gestureMovedRef = useRef(false)
  const lastTapRef = useRef<{ time: number; point: MapPoint } | null>(null)
  const [viewportSize, setViewportSize] = useState({ width: 1, height: 1 })
  const [view, setViewState] = useState<ViewBox>(viewRef.current)

  const routeSet = useMemo(() => new Set(routeStationIds), [routeStationIds])
  const routeEndpoints = useMemo(() => new Set(routeStationIds.length ? [routeStationIds[0], routeStationIds.at(-1)!] : []), [routeStationIds])
  const fitView = useMemo(() => fitViewForViewport(viewportSize), [viewportSize])

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

  const clampView = useCallback((candidate: ViewBox): ViewBox => {
    const aspect = viewportSize.width / viewportSize.height
    const maximumWidth = Math.max(fitView.width, MAP_BOUNDS.width) * 1.08
    const width = Math.min(maximumWidth, Math.max(MIN_VIEW_WIDTH, candidate.width))
    const height = width / aspect
    const allowanceX = Math.min(72, width * 0.08)
    const allowanceY = Math.min(72, height * 0.08)
    const minimumX = MAP_BOUNDS.x - allowanceX
    const maximumX = MAP_BOUNDS.x + MAP_BOUNDS.width - width + allowanceX
    const minimumY = MAP_BOUNDS.y - allowanceY
    const maximumY = MAP_BOUNDS.y + MAP_BOUNDS.height - height + allowanceY
    const x = minimumX > maximumX
      ? MAP_BOUNDS.x + MAP_BOUNDS.width / 2 - width / 2
      : Math.min(maximumX, Math.max(minimumX, candidate.x))
    const y = minimumY > maximumY
      ? MAP_BOUNDS.y + MAP_BOUNDS.height / 2 - height / 2
      : Math.min(maximumY, Math.max(minimumY, candidate.y))

    return { x, y, width, height }
  }, [fitView.width, viewportSize])

  const setView = useCallback((candidate: ViewBox) => {
    const next = clampView(candidate)
    viewRef.current = next
    setViewState(next)
  }, [clampView])

  const fitMap = useCallback(() => setView(fitView), [fitView, setView])

  const openReadableView = useCallback(() => {
    setView(readableViewForViewport(viewportSize))
  }, [setView, viewportSize])

  const localPoint = (clientX: number, clientY: number): MapPoint => {
    const rect = viewportRef.current?.getBoundingClientRect()
    return rect ? { x: clientX - rect.left, y: clientY - rect.top } : { x: clientX, y: clientY }
  }

  const screenToMap = useCallback((point: MapPoint, source = viewRef.current): MapPoint => ({
    x: source.x + (point.x / viewportSize.width) * source.width,
    y: source.y + (point.y / viewportSize.height) * source.height,
  }), [viewportSize])

  const zoomToWidthAt = useCallback((requestedWidth: number, point?: MapPoint) => {
    const current = viewRef.current
    const anchor = point ?? { x: viewportSize.width / 2, y: viewportSize.height / 2 }
    const anchorMap = screenToMap(anchor, current)
    const width = requestedWidth
    const height = width / (viewportSize.width / viewportSize.height)
    setView({
      x: anchorMap.x - (anchor.x / viewportSize.width) * width,
      y: anchorMap.y - (anchor.y / viewportSize.height) * height,
      width,
      height,
    })
  }, [screenToMap, setView, viewportSize])

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

    const current = viewRef.current
    const center = { x: current.x + current.width / 2, y: current.y + current.height / 2 }
    setView({
      x: center.x - current.width / 2,
      y: center.y - (current.width / (viewportSize.width / viewportSize.height)) / 2,
      width: current.width,
      height: current.width / (viewportSize.width / viewportSize.height),
    })
  }, [fitMap, setView, viewportSize])

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
        anchorMap: screenToMap(center, current),
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
        x: gesture.startView.x - (dx / viewportSize.width) * gesture.startView.width,
        y: gesture.startView.y - (dy / viewportSize.height) * gesture.startView.height,
        width: gesture.startView.width,
        height: gesture.startView.height,
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
      const width = gesture.startView.width / (nextDistance / gesture.startDistance)
      const height = width / (viewportSize.width / viewportSize.height)
      gestureMovedRef.current = true
      setView({
        x: gesture.anchorMap.x - (center.x / viewportSize.width) * width,
        y: gesture.anchorMap.y - (center.y / viewportSize.height) * height,
        width,
        height,
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
        zoomToWidthAt(viewRef.current.width / 1.55, point)
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
    zoomToWidthAt(viewRef.current.width * Math.exp(event.deltaY * 0.0015), localPoint(event.clientX, event.clientY))
  }

  const zoomPercent = Math.round((fitView.width / view.width) * 100)

  return (
    <section className="map-card map-viewer-card card">
      <header className="map-header map-viewer-header">
        <div>
          <span className="eyebrow">{language === 'uk' ? 'Інтерактивна схема' : 'Interactive map'}</span>
          <h2>{language === 'uk' ? 'Київський метрополітен' : 'Kyiv Metro'}</h2>
          <p>{language === 'uk' ? 'Усі 52 станції на схемі. Рухайте одним пальцем, масштабуйте двома.' : 'All 52 stations are shown. Pan with one finger and pinch with two.'}</p>
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
        onDoubleClick={(event: ReactMouseEvent<HTMLDivElement>) => zoomToWidthAt(viewRef.current.width / 1.45, localPoint(event.clientX, event.clientY))}
      >
        <svg
          className="metro-map metro-map-v140"
          viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={language === 'uk' ? 'Схема трьох ліній Київського метро з усіма станціями' : 'Map of all stations on the three Kyiv Metro lines'}
        >
          <rect x={view.x} y={view.y} width={view.width} height={view.height} className="map-paper" />
          <path d={RIVER_PATH} className="metro-river-v140" />

          {Object.values(lines).map((line) => (
            <g key={line.id}>
              <path d={roundedPath(pointsForLine(line.id), 18)} className="metro-line-halo-v140" />
              <path d={roundedPath(pointsForLine(line.id), 18)} className="metro-line-base metro-line-v140" style={{ stroke: line.color }} />
            </g>
          ))}

          {Object.values(lines).flatMap((line) =>
            line.stationIds.slice(0, -1).map((stationId, index) => {
              const nextId = line.stationIds[index + 1]
              if (!activeLineSegments.has(`${stationId}:${nextId}`)) return null
              return (
                <path
                  key={`active-${stationId}-${nextId}`}
                  d={roundedPath([pointForStation(stationId), pointForStation(nextId)], 0)}
                  className="metro-line-active metro-line-active-v140"
                  style={{ stroke: line.color }}
                />
              )
            }),
          )}

          {transferPairs.map(([firstId, secondId]) => {
            const first = pointForStation(firstId)
            const second = pointForStation(secondId)
            const active = routeSet.has(firstId) && routeSet.has(secondId)
            return (
              <g key={`${firstId}-${secondId}`}>
                <line x1={first.x} y1={first.y} x2={second.x} y2={second.y} className="transfer-link-halo-v140" />
                <line x1={first.x} y1={first.y} x2={second.x} y2={second.y} className={`transfer-link transfer-link-v140 ${active ? 'active' : ''}`} />
              </g>
            )
          })}

          {LINE_BADGES.map(({ line, stationId, dx, dy }) => {
            const point = pointForStation(stationId)
            return (
              <g key={`${line}-${stationId}`} className="map-line-badge" transform={`translate(${point.x + dx} ${point.y + dy})`}>
                <circle r="15" style={{ fill: lines[line].color }} />
                <text textAnchor="middle" dominantBaseline="central">{line}</text>
              </g>
            )
          })}

          {stations.map((station) => {
            const point = pointForStation(station)
            const placement = placementForStation(station)
            const name = stationName(station)
            const linesToRender = labelLines(station, language, name)
            const labelX = point.x + placement.dx
            const labelY = point.y + placement.dy - (placement.dy < 0 ? (linesToRender.length - 1) * LABEL_LINE_HEIGHT : 0)
            const active = activeStationId === station.id
            const onRoute = routeSet.has(station.id)
            const endpoint = routeEndpoints.has(station.id)
            const central = CENTRAL_LABELS.has(station.id)

            return (
              <g
                key={station.id}
                className={`map-station ${active ? 'active' : ''} ${onRoute ? 'on-route' : ''} ${endpoint ? 'route-endpoint' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={name}
                onPointerDown={(event: ReactPointerEvent<SVGGElement>) => event.stopPropagation()}
                onClick={() => onStationClick(station.id)}
                onKeyDown={(event: ReactKeyboardEvent<SVGGElement>) => (event.key === 'Enter' || event.key === ' ') && onStationClick(station.id)}
              >
                <circle cx={point.x} cy={point.y} r="19" className="station-hit-area" />
                {station.transferTo && <circle cx={point.x} cy={point.y} r="10.5" className="transfer-ring transfer-ring-v140" />}
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={active ? 8.5 : endpoint ? 7.5 : onRoute ? 6.8 : 5.5}
                  className="station-node station-node-v140"
                  style={{ stroke: lines[station.line].color }}
                />
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor={placement.anchor}
                  className={`station-label station-label-v140 ${central ? 'station-label-central-v140' : ''}`}
                >
                  {linesToRender.map((line, index) => (
                    <tspan key={`${station.id}-${index}`} x={labelX} dy={index === 0 ? 0 : LABEL_LINE_HEIGHT}>
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            )
          })}
        </svg>

        <div className="map-viewer-controls" aria-label={language === 'uk' ? 'Масштаб схеми' : 'Map zoom'}>
          <button type="button" onClick={() => zoomToWidthAt(viewRef.current.width / 1.25)} aria-label={language === 'uk' ? 'Збільшити схему' : 'Zoom in'}>+</button>
          <span>{zoomPercent}%</span>
          <button type="button" onClick={() => zoomToWidthAt(viewRef.current.width * 1.25)} aria-label={language === 'uk' ? 'Зменшити схему' : 'Zoom out'}>−</button>
          <button type="button" onClick={openReadableView} aria-label={language === 'uk' ? 'Повернути читабельний масштаб' : 'Restore readable zoom'}>
            <Icon name="refresh" size={18} />
          </button>
        </div>

        <div className="map-viewer-hint" aria-hidden="true">
          <span>↔</span>{language === 'uk' ? 'рух' : 'pan'}
          <span>⌕</span>{language === 'uk' ? 'масштаб' : 'zoom'}
        </div>
      </div>

      <footer className="map-legend map-legend-v140">
        {Object.values(lines).map((line) => (
          <span key={line.id}><i style={{ background: line.color }} /> {line.id}</span>
        ))}
        <span className="map-tip"><Icon name="info" size={15} /> {language === 'uk' ? 'Натисніть станцію для деталей' : 'Tap a station for details'}</span>
      </footer>
    </section>
  )
}
