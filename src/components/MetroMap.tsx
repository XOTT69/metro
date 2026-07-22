import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react'
import { lines, stationById, stations, transferPairs } from '../data/metro'
import type { LineId, Station } from '../types'
import { Icon } from './Icon'

interface Props {
  activeStationId?: string
  routeStationIds?: string[]
  onStationClick: (stationId: string) => void
}

interface MapView { x: number; y: number; width: number; height: number }
interface Point { x: number; y: number }

const FULL_VIEW: MapView = { x: 25, y: 10, width: 910, height: 690 }
const BOUNDS = { x: 0, y: 0, width: 960, height: 710 }
const ASPECT = FULL_VIEW.width / FULL_VIEW.height
const MIN_WIDTH = 380
const MAX_WIDTH = 1080
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

const constrain = (value: number, size: number, start: number, total: number) => {
  const overscroll = Math.min(45, size * 0.07)
  const minimum = start - overscroll
  const maximum = start + total - size + overscroll
  if (minimum > maximum) return start + (total - size) / 2
  return Math.min(maximum, Math.max(minimum, value))
}

const clampView = (candidate: MapView): MapView => {
  const width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, candidate.width))
  const height = width / ASPECT
  return {
    x: constrain(candidate.x, width, BOUNDS.x, BOUNDS.width),
    y: constrain(candidate.y, height, BOUNDS.y, BOUNDS.height),
    width,
    height,
  }
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

const viewForStations = (ids: string[], padding = 90): MapView | null => {
  const selected = ids.map((id) => stationById.get(id)).filter(Boolean) as Station[]
  if (!selected.length) return null
  const minX = Math.min(...selected.map((station) => station.mapX))
  const maxX = Math.max(...selected.map((station) => station.mapX))
  const minY = Math.min(...selected.map((station) => station.mapY))
  const maxY = Math.max(...selected.map((station) => station.mapY))
  const contentWidth = Math.max(120, maxX - minX + padding * 2)
  const contentHeight = Math.max(120, maxY - minY + padding * 2)
  const width = Math.max(contentWidth, contentHeight * ASPECT)
  return clampView({
    x: (minX + maxX) / 2 - width / 2,
    y: (minY + maxY) / 2 - width / ASPECT / 2,
    width,
    height: width / ASPECT,
  })
}

export const MetroMap = ({ activeStationId, routeStationIds = [], onStationClick }: Props) => {
  const [view, setView] = useState<MapView>(FULL_VIEW)
  const [focusedLine, setFocusedLine] = useState<LineId | 'all'>('all')
  const svgRef = useRef<SVGSVGElement | null>(null)
  const pointers = useRef(new Map<number, Point>())
  const moved = useRef(false)

  const routeKey = routeStationIds.join(':')
  const routeSet = useMemo(() => new Set(routeStationIds), [routeKey])
  const routeSegments = useMemo(() => {
    const result = new Set<string>()
    Object.values(lines).forEach((line) => line.stationIds.slice(0, -1).forEach((id, index) => {
      const next = line.stationIds[index + 1]
      if (routeSet.has(id) && routeSet.has(next)) result.add(`${id}:${next}`)
    }))
    return result
  }, [routeSet])

  const selectedLine = focusedLine === 'all' ? null : lines[focusedLine]
  const zoomPercent = Math.round((FULL_VIEW.width / view.width) * 100)

  const zoomAround = (factor: number, point?: Point) => {
    setView((current) => {
      const rect = svgRef.current?.getBoundingClientRect()
      const ratioX = rect && point ? (point.x - rect.left) / rect.width : 0.5
      const ratioY = rect && point ? (point.y - rect.top) / rect.height : 0.5
      const anchorX = current.x + ratioX * current.width
      const anchorY = current.y + ratioY * current.height
      const width = current.width / factor
      const height = width / ASPECT
      return clampView({ x: anchorX - ratioX * width, y: anchorY - ratioY * height, width, height })
    })
  }

  const reset = () => {
    setFocusedLine('all')
    setView(FULL_VIEW)
  }

  const focusLine = (lineId: LineId | 'all') => {
    setFocusedLine(lineId)
    if (lineId === 'all') setView(FULL_VIEW)
    else {
      const next = viewForStations(lines[lineId].stationIds, 75)
      if (next) setView(next)
    }
  }

  const focusRoute = () => {
    const next = viewForStations(routeStationIds, 115)
    if (next) setView(next)
  }

  const handleWheel = (event: ReactWheelEvent<SVGSVGElement>) => {
    event.preventDefault()
    zoomAround(Math.exp(-event.deltaY * 0.0014), { x: event.clientX, y: event.clientY })
  }

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if ((event.target as Element).closest('.map-station')) return
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    moved.current = false
  }

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(event.pointerId)) return
    const before = new Map(pointers.current)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const rect = event.currentTarget.getBoundingClientRect()

    if (before.size === 1) {
      const previous = before.get(event.pointerId)
      if (!previous) return
      const dx = event.clientX - previous.x
      const dy = event.clientY - previous.y
      if (Math.abs(dx) + Math.abs(dy) > 2) moved.current = true
      setView((current) => clampView({
        ...current,
        x: current.x - (dx / rect.width) * current.width,
        y: current.y - (dy / rect.height) * current.height,
      }))
      return
    }

    const ids = [...before.keys()].slice(0, 2)
    if (ids.length < 2) return
    const previousFirst = before.get(ids[0])!
    const previousSecond = before.get(ids[1])!
    const nextFirst = pointers.current.get(ids[0])!
    const nextSecond = pointers.current.get(ids[1])!
    const previousDistance = distance(previousFirst, previousSecond)
    const nextDistance = distance(nextFirst, nextSecond)
    if (previousDistance < 2 || nextDistance < 2) return

    const previousCenter = midpoint(previousFirst, previousSecond)
    const nextCenter = midpoint(nextFirst, nextSecond)
    const factor = Math.min(1.2, Math.max(0.84, nextDistance / previousDistance))
    moved.current = true
    setView((current) => {
      const previousX = (previousCenter.x - rect.left) / rect.width
      const previousY = (previousCenter.y - rect.top) / rect.height
      const nextX = (nextCenter.x - rect.left) / rect.width
      const nextY = (nextCenter.y - rect.top) / rect.height
      const anchorX = current.x + previousX * current.width
      const anchorY = current.y + previousY * current.height
      const width = current.width / factor
      const height = width / ASPECT
      return clampView({ x: anchorX - nextX * width, y: anchorY - nextY * height, width, height })
    })
  }

  const releasePointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    pointers.current.delete(event.pointerId)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const lineIsDimmed = (lineId: LineId) => focusedLine !== 'all' && focusedLine !== lineId

  return (
    <section className="map-card map-card-v6 card">
      <header className="map-header map-header-v6">
        <div>
          <span className="eyebrow">Інтерактивна схема</span>
          <h2>Київський метрополітен</h2>
          <p>Схема завжди відкривається повністю. Масштаб і позиція змінюються лише вручну.</p>
        </div>
        <div className="map-header-actions">
          {routeStationIds.length > 1 && <button type="button" className="map-route-focus" onClick={focusRoute}><Icon name="route" size={17} /> Маршрут</button>}
          <div className="zoom-controls" aria-label="Масштаб схеми">
            <button type="button" onClick={() => zoomAround(0.8)} aria-label="Зменшити">−</button>
            <span>{zoomPercent}%</span>
            <button type="button" onClick={() => zoomAround(1.25)} aria-label="Збільшити">+</button>
          </div>
          <button type="button" className="map-reset-button" onClick={reset} aria-label="Показати всю схему"><Icon name="refresh" size={18} /></button>
        </div>
      </header>

      <div className="map-line-toolbar" aria-label="Фільтр ліній">
        <button type="button" className={focusedLine === 'all' ? 'active' : ''} onClick={() => focusLine('all')}>Усі лінії</button>
        {lineIds.map((lineId) => <button type="button" className={focusedLine === lineId ? 'active' : ''} onClick={() => focusLine(lineId)} key={lineId}>
          <i style={{ background: lines[lineId].color }} /> {lineId} <span>{lines[lineId].stationIds.length}</span>
        </button>)}
      </div>

      <div className="map-workspace">
        <div className="map-viewport" role="region" aria-label="Інтерактивна схема метро">
          <svg
            ref={svgRef}
            className="metro-map metro-map-v6"
            viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
            role="img"
            aria-label="Схема трьох ліній Київського метро"
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={releasePointer}
            onPointerCancel={releasePointer}
          >
            {Object.values(lines).map((line) => {
              const points = line.stationIds.map((id) => stationById.get(id)!).map((station) => `${station.mapX},${station.mapY}`).join(' ')
              return <polyline key={line.id} points={points} className={`metro-line-base ${lineIsDimmed(line.id) ? 'is-dimmed' : ''}`} style={{ stroke: line.color }} />
            })}

            {Object.values(lines).flatMap((line) => line.stationIds.slice(0, -1).map((id, index) => {
              const nextId = line.stationIds[index + 1]
              if (!routeSegments.has(`${id}:${nextId}`)) return null
              const from = stationById.get(id)!
              const to = stationById.get(nextId)!
              return <line key={`${id}-${nextId}`} x1={from.mapX} y1={from.mapY} x2={to.mapX} y2={to.mapY} className="metro-line-active" style={{ stroke: line.color }} />
            }))}

            {transferPairs.map(([firstId, secondId]) => {
              const first = stationById.get(firstId)!
              const second = stationById.get(secondId)!
              const active = routeSet.has(firstId) && routeSet.has(secondId)
              return <line key={`${firstId}-${secondId}`} x1={first.mapX} y1={first.mapY} x2={second.mapX} y2={second.mapY} className={`transfer-link ${active ? 'active' : ''}`} />
            })}

            {stations.map((station) => {
              const label = labelPosition(station.id, station.line)
              const active = activeStationId === station.id
              const onRoute = routeSet.has(station.id)
              const dimmed = lineIsDimmed(station.line) && !onRoute
              return <g
                key={station.id}
                className={`map-station ${active ? 'active' : ''} ${onRoute ? 'on-route' : ''} ${dimmed ? 'is-dimmed' : ''}`}
                role="button"
                tabIndex={dimmed ? -1 : 0}
                aria-label={`${station.name}, ${lines[station.line].name}`}
                onPointerDown={(event) => { moved.current = false; event.stopPropagation() }}
                onClick={() => !moved.current && onStationClick(station.id)}
                onKeyDown={(event) => (event.key === 'Enter' || event.key === ' ') && onStationClick(station.id)}
              >
                {station.transferTo && <circle cx={station.mapX} cy={station.mapY} r="9" className="transfer-ring" />}
                <circle cx={station.mapX} cy={station.mapY} r={active ? 7 : onRoute ? 6 : 4.8} className="station-node" style={{ stroke: lines[station.line].color }} />
                <text x={station.mapX + label.dx} y={station.mapY + label.dy} textAnchor={label.anchor} className="station-label">{station.name}</text>
              </g>
            })}
          </svg>
          <div className="map-gesture-hint" aria-hidden="true"><span>↔</span> Рухайте <span>⌕</span> Масштабуйте</div>
        </div>

        <aside className="map-line-panel" aria-label={selectedLine ? `Станції лінії ${selectedLine.id}` : 'Лінії метро'}>
          {selectedLine ? <>
            <header><span className="line-pill" style={{ background: selectedLine.color }}>{selectedLine.id}</span><div><strong>{selectedLine.name}</strong><small>{selectedLine.terminalStart} — {selectedLine.terminalEnd}</small></div></header>
            <div className="map-line-stations">{selectedLine.stationIds.map((id, index) => {
              const station = stationById.get(id)!
              return <button type="button" className={routeSet.has(id) ? 'on-route' : ''} onClick={() => onStationClick(id)} key={id}>
                <span className="map-line-order">{index + 1}</span><span><strong>{station.name}</strong><small>{station.nameEn}</small></span><Icon name="chevron" size={17} />
              </button>
            })}</div>
          </> : <div className="map-lines-overview">
            <span className="eyebrow">Швидкий огляд</span><h3>Три лінії</h3><p>Оберіть лінію, щоб побачити її окремо та відкрити список станцій.</p>
            {lineIds.map((lineId) => <button type="button" onClick={() => focusLine(lineId)} key={lineId}><i style={{ background: lines[lineId].color }} /><span><strong>{lineId} · {lines[lineId].name}</strong><small>{lines[lineId].terminalStart} — {lines[lineId].terminalEnd}</small></span><Icon name="chevron" size={18} /></button>)}
          </div>}
        </aside>
      </div>

      <footer className="map-legend map-legend-v6"><span className="map-tip"><Icon name="info" size={15} /> Торкніться станції, щоб відкрити деталі</span></footer>
    </section>
  )
}
