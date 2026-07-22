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
import { Icon } from './Icon'

interface Props {
  activeStationId?: string
  routeStationIds?: string[]
  onStationClick: (stationId: string) => void
}

interface Point { x: number; y: number }
interface ViewTransform { scale: number; x: number; y: number }
interface PanGesture { kind: 'pan'; startView: ViewTransform; startPoint: Point }
interface PinchGesture { kind: 'pinch'; startView: ViewTransform; startDistance: number; anchorImage: Point }
type Gesture = PanGesture | PinchGesture

const MAP_WIDTH = 960
const MAP_HEIGHT = 710
const MIN_SCALE = 0.45
const MAX_SCALE = 4.5
const EDGE_ALLOWANCE = 64

const distance = (first: Point, second: Point) => Math.hypot(first.x - second.x, first.y - second.y)
const midpoint = (first: Point, second: Point): Point => ({ x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 })
const clampScale = (value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))

export const MetroMap = ({ activeStationId, routeStationIds = [], onStationClick }: Props) => {
  const { language, stationName } = useLanguage()
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const pointersRef = useRef(new Map<number, Point>())
  const gestureRef = useRef<Gesture | null>(null)
  const viewRef = useRef<ViewTransform>({ scale: 0.8, x: 0, y: 0 })
  const initializedRef = useRef(false)
  const gestureMovedRef = useRef(false)
  const [viewportSize, setViewportSize] = useState({ width: 1, height: 1 })
  const [view, setViewState] = useState<ViewTransform>(viewRef.current)

  const routeSet = useMemo(() => new Set(routeStationIds), [routeStationIds])
  const routeSegments = useMemo(() => routeStationIds.slice(0, -1).flatMap((id, index) => {
    const from = stationById.get(id)
    const to = stationById.get(routeStationIds[index + 1])
    if (!from || !to) return []
    return [{ from, to, transfer: from.line !== to.line }]
  }), [routeStationIds])

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

  const fitBounds = useCallback((points: Point[], padding = 42) => {
    if (!points.length) return
    const minX = Math.min(...points.map((point) => point.x))
    const maxX = Math.max(...points.map((point) => point.x))
    const minY = Math.min(...points.map((point) => point.y))
    const maxY = Math.max(...points.map((point) => point.y))
    const width = Math.max(80, maxX - minX)
    const height = Math.max(80, maxY - minY)
    const scale = clampScale(Math.min((viewportSize.width - padding * 2) / width, (viewportSize.height - padding * 2) / height))
    setView({
      scale,
      x: viewportSize.width / 2 - ((minX + maxX) / 2) * scale,
      y: viewportSize.height / 2 - ((minY + maxY) / 2) * scale,
    })
  }, [setView, viewportSize])

  const fitMap = useCallback(() => fitBounds([{ x: 35, y: 24 }, { x: 925, y: 680 }], 12), [fitBounds])
  const focusRoute = useCallback(() => {
    const points = routeStationIds
      .map((id) => stationById.get(id))
      .filter(Boolean)
      .map((station) => ({ x: station!.mapX, y: station!.mapY }))
    if (points.length > 1) fitBounds(points, 58)
    else fitMap()
  }, [fitBounds, fitMap, routeStationIds])

  const zoomAt = useCallback((requestedScale: number, point?: Point) => {
    const current = viewRef.current
    const scale = clampScale(requestedScale)
    const anchor = point ?? { x: viewportSize.width / 2, y: viewportSize.height / 2 }
    const imageX = (anchor.x - current.x) / current.scale
    const imageY = (anchor.y - current.y) / current.scale
    setView({ scale, x: anchor.x - imageX * scale, y: anchor.y - imageY * scale })
  }, [setView, viewportSize])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || typeof ResizeObserver === 'undefined') return
    const update = () => setViewportSize({ width: Math.max(1, viewport.clientWidth), height: Math.max(1, viewport.clientHeight) })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (viewportSize.width <= 1 || viewportSize.height <= 1) return
    if (!initializedRef.current) {
      initializedRef.current = true
      routeStationIds.length > 1 ? focusRoute() : fitMap()
      return
    }
    setView(viewRef.current)
  }, [fitMap, focusRoute, routeStationIds.length, setView, viewportSize])

  const localPoint = (clientX: number, clientY: number): Point => {
    const rect = viewportRef.current?.getBoundingClientRect()
    return rect ? { x: clientX - rect.left, y: clientY - rect.top } : { x: clientX, y: clientY }
  }

  const beginGesture = () => {
    const points = [...pointersRef.current.values()]
    const current = viewRef.current
    if (points.length === 1) gestureRef.current = { kind: 'pan', startView: current, startPoint: points[0] }
    if (points.length >= 2) {
      const center = midpoint(points[0], points[1])
      gestureRef.current = {
        kind: 'pinch',
        startView: current,
        startDistance: Math.max(1, distance(points[0], points[1])),
        anchorImage: { x: (center.x - current.x) / current.scale, y: (center.y - current.y) / current.scale },
      }
    }
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
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
      if (Math.abs(dx) + Math.abs(dy) > 4) gestureMovedRef.current = true
      setView({ scale: gesture.startView.scale, x: gesture.startView.x + dx, y: gesture.startView.y + dy })
      return
    }
    if (points.length >= 2) {
      if (gesture.kind !== 'pinch') { beginGesture(); return }
      const center = midpoint(points[0], points[1])
      const scale = clampScale(gesture.startView.scale * (Math.max(1, distance(points[0], points[1])) / gesture.startDistance))
      gestureMovedRef.current = true
      setView({ scale, x: center.x - gesture.anchorImage.x * scale, y: center.y - gesture.anchorImage.y * scale })
    }
  }

  const releasePointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    gestureRef.current = null
    if (pointersRef.current.size) beginGesture()
  }

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    zoomAt(viewRef.current.scale * Math.exp(-event.deltaY * 0.0015), localPoint(event.clientX, event.clientY))
  }

  const activateStation = (stationId: string) => {
    if (gestureMovedRef.current) return
    onStationClick(stationId)
  }

  return (
    <section className="map-card map-viewer-card card">
      <header className="map-header map-viewer-header">
        <div>
          <span className="eyebrow">{language === 'uk' ? 'Інтерактивна SVG-схема' : 'Interactive SVG map'}</span>
          <h2>{language === 'uk' ? 'Київське метро' : 'Kyiv Metro'}</h2>
          <p>{language === 'uk' ? 'Натисніть на станцію для деталей. Схема лишається чіткою за будь-якого масштабу.' : 'Tap a station for details. The map stays sharp at every zoom level.'}</p>
        </div>
        <div className="map-header-actions">
          {routeStationIds.length > 1 && <button type="button" className="map-fit-button" onClick={focusRoute}><Icon name="route" size={17} />{language === 'uk' ? 'Маршрут' : 'Route'}</button>}
          <button type="button" className="map-fit-button" onClick={fitMap}><Icon name="refresh" size={17} />{language === 'uk' ? 'Уся схема' : 'Fit map'}</button>
        </div>
      </header>

      <div
        ref={viewportRef}
        className="map-panzoom-viewport map-scroll-pinch svg-metro-viewport"
        role="region"
        aria-label={language === 'uk' ? 'Інтерактивна схема Київського метро' : 'Interactive Kyiv Metro map'}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={releasePointer}
        onPointerCancel={releasePointer}
        onWheel={handleWheel}
        onDoubleClick={(event) => zoomAt(viewRef.current.scale * 1.45, localPoint(event.clientX, event.clientY))}
      >
        <div
          className="map-image-canvas svg-map-canvas"
          style={{ width: `${MAP_WIDTH}px`, height: `${MAP_HEIGHT}px`, transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})` }}
        >
          <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} width={MAP_WIDTH} height={MAP_HEIGHT} className="metro-svg" aria-hidden="true">
            <rect width={MAP_WIDTH} height={MAP_HEIGHT} rx="26" className="metro-svg-background" />

            {Object.values(lines).map((line) => {
              const points = line.stationIds.map((id) => stationById.get(id)).filter(Boolean).map((station) => `${station!.mapX},${station!.mapY}`).join(' ')
              return <polyline key={line.id} points={points} className="metro-line-shadow" />
            })}
            {Object.values(lines).map((line) => {
              const points = line.stationIds.map((id) => stationById.get(id)).filter(Boolean).map((station) => `${station!.mapX},${station!.mapY}`).join(' ')
              return <polyline key={line.id} points={points} fill="none" stroke={line.color} className="metro-line" />
            })}

            {transferPairs.map(([fromId, toId]) => {
              const from = stationById.get(fromId)
              const to = stationById.get(toId)
              return from && to ? <line key={`${fromId}-${toId}`} x1={from.mapX} y1={from.mapY} x2={to.mapX} y2={to.mapY} className="metro-transfer-link" /> : null
            })}

            {routeSegments.map(({ from, to, transfer }, index) => (
              <line
                key={`${from.id}-${to.id}-${index}`}
                x1={from.mapX}
                y1={from.mapY}
                x2={to.mapX}
                y2={to.mapY}
                className={transfer ? 'metro-route-transfer' : 'metro-route-line'}
                stroke={transfer ? undefined : lines[from.line].color}
              />
            ))}

            {stations.map((station) => {
              const line = lines[station.line]
              const active = station.id === activeStationId
              const onRoute = routeSet.has(station.id)
              const transfer = Boolean(station.transferTo?.length)
              const labelOnLeft = station.line === 'M2' || station.mapX > 700
              return (
                <g
                  key={station.id}
                  className={`metro-station-node ${active ? 'is-active' : ''} ${onRoute ? 'is-route' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-label={stationName(station)}
                  onClick={(event) => { event.stopPropagation(); activateStation(station.id) }}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') activateStation(station.id) }}
                >
                  <circle cx={station.mapX} cy={station.mapY} r="17" className="station-hit-area" />
                  {transfer && <circle cx={station.mapX} cy={station.mapY} r="10" className="station-transfer-ring" />}
                  <circle cx={station.mapX} cy={station.mapY} r={active ? 8 : onRoute ? 7 : 5.5} fill={active || onRoute ? line.color : undefined} className="station-visible-dot" />
                  <text x={labelOnLeft ? station.mapX - 12 : station.mapX + 12} y={station.mapY + 4} textAnchor={labelOnLeft ? 'end' : 'start'} className="station-map-label">{stationName(station)}</text>
                  {active && (
                    <g className="active-station-label">
                      <rect x={station.mapX - 72} y={station.mapY - 43} width="144" height="25" rx="9" />
                      <text x={station.mapX} y={station.mapY - 26} textAnchor="middle">{stationName(station)}</text>
                    </g>
                  )}
                </g>
              )
            })}
          </svg>
        </div>

        <div className="map-viewer-controls" aria-label={language === 'uk' ? 'Масштаб схеми' : 'Map zoom'}>
          <button type="button" onClick={() => zoomAt(viewRef.current.scale * 1.25)} aria-label={language === 'uk' ? 'Збільшити схему' : 'Zoom in'}>+</button>
          <span>{Math.round(view.scale * 100)}%</span>
          <button type="button" onClick={() => zoomAt(viewRef.current.scale / 1.25)} aria-label={language === 'uk' ? 'Зменшити схему' : 'Zoom out'}>−</button>
          <button type="button" onClick={fitMap} aria-label={language === 'uk' ? 'Показати всю схему' : 'Fit full map'}><Icon name="refresh" size={18} /></button>
        </div>
      </div>

      <footer className="map-legend map-legend-v140 official-map-credit">
        <span>{language === 'uk' ? 'Векторна схема · 52 станції' : 'Vector map · 52 stations'}</span>
        <span className="map-tip"><Icon name="info" size={15} /> {language === 'uk' ? 'Точки інтерактивні: відкривають розклад і деталі станції' : 'Station dots open schedule and station details'}</span>
      </footer>
    </section>
  )
}
