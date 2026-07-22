import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import { useLanguage } from '../lib/i18n'
import { Icon } from './Icon'

interface Props {
  activeStationId?: string
  routeStationIds?: string[]
  onStationClick: (stationId: string) => void
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
  startDistance: number
  anchorImage: Point
}

type Gesture = PanGesture | PinchGesture

const MAP_WIDTH = 2000
const MAP_HEIGHT = 2091
const MIN_SCALE = 0.22
const MAX_SCALE = 3.25
const EDGE_ALLOWANCE = 56
const MAP_SOURCE = 'https://24tv.ua/resources/photos/news/202508/2899048_17443474.jpg?fit=cover&h=2091&output=webp&v=1755835501000&w=2000'

const distance = (first: Point, second: Point) => Math.hypot(first.x - second.x, first.y - second.y)

const midpoint = (first: Point, second: Point): Point => ({
  x: (first.x + second.x) / 2,
  y: (first.y + second.y) / 2,
})

const clampScale = (value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))

export const MetroMap = (_props: Props) => {
  const { language } = useLanguage()
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const pointersRef = useRef(new Map<number, Point>())
  const gestureRef = useRef<Gesture | null>(null)
  const viewRef = useRef<ViewTransform>({ scale: 0.35, x: 0, y: 0 })
  const initializedRef = useRef(false)
  const gestureMovedRef = useRef(false)
  const lastTapRef = useRef<{ time: number; point: Point } | null>(null)
  const [viewportSize, setViewportSize] = useState({ width: 1, height: 1 })
  const [view, setViewState] = useState<ViewTransform>(viewRef.current)

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
    const horizontal = (viewportSize.width - 12) / MAP_WIDTH
    const vertical = (viewportSize.height - 12) / MAP_HEIGHT
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
    const imageX = (anchor.x - current.x) / current.scale
    const imageY = (anchor.y - current.y) / current.scale
    setView({
      scale,
      x: anchor.x - imageX * scale,
      y: anchor.y - imageY * scale,
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
        startDistance: Math.max(1, distance(points[0], points[1])),
        anchorImage: {
          x: (center.x - current.x) / current.scale,
          y: (center.y - current.y) / current.scale,
        },
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
        x: center.x - gesture.anchorImage.x * scale,
        y: center.y - gesture.anchorImage.y * scale,
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
    zoomAt(viewRef.current.scale * Math.exp(-event.deltaY * 0.0015), localPoint(event.clientX, event.clientY))
  }

  return (
    <section className="map-card map-viewer-card card">
      <header className="map-header map-viewer-header">
        <div>
          <span className="eyebrow">{language === 'uk' ? 'Офіційна схема' : 'Official-style map'}</span>
          <h2>{language === 'uk' ? 'Київське метро' : 'Kyiv Metro'}</h2>
          <p>{language === 'uk' ? 'Повна схема метро й швидкісного транспорту. Рухайте одним пальцем, масштабуйте двома.' : 'Full metro and rapid transit map. Pan with one finger and pinch with two.'}</p>
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
        aria-label={language === 'uk' ? 'Схема Київського метро та швидкісного транспорту' : 'Kyiv Metro and rapid transit map'}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={releasePointer}
        onPointerCancel={releasePointer}
        onWheel={handleWheel}
        onDoubleClick={(event) => zoomAt(viewRef.current.scale * 1.45, localPoint(event.clientX, event.clientY))}
      >
        <div
          className="map-image-canvas"
          style={{
            width: `${MAP_WIDTH}px`,
            height: `${MAP_HEIGHT}px`,
            transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`,
          }}
        >
          <img
            className="official-metro-map-image"
            src={MAP_SOURCE}
            width={MAP_WIDTH}
            height={MAP_HEIGHT}
            alt={language === 'uk' ? 'Київське метро та швидкісний транспорт — схема всіх ліній і станцій' : 'Kyiv Metro and rapid transit map with all lines and stations'}
            draggable={false}
            decoding="async"
          />
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

      <footer className="map-legend map-legend-v140 official-map-credit">
        <span>{language === 'uk' ? 'Дизайн: «Агенти змін»' : 'Design: Agents of Change'}</span>
        <span className="map-tip"><Icon name="info" size={15} /> {language === 'uk' ? 'Для деталей станцій відкрийте каталог «Станції»' : 'Open the Stations catalog for station details'}</span>
      </footer>
    </section>
  )
}
