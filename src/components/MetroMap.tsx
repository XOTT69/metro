import { useMemo, useState } from 'react'
import { lines, stationById, stations, transferPairs } from '../data/metro'
import type { LineId } from '../types'
import { Icon } from './Icon'

interface Props {
  activeStationId?: string
  routeStationIds?: string[]
  onStationClick: (stationId: string) => void
}

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

export const MetroMap = ({ activeStationId, routeStationIds = [], onStationClick }: Props) => {
  const [zoom, setZoom] = useState(1)
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

  return (
    <section className="map-card card">
      <header className="map-header">
        <div>
          <span className="eyebrow">Інтерактивна схема</span>
          <h2>Київський метрополітен</h2>
        </div>
        <div className="zoom-controls" aria-label="Масштаб карти">
          <button type="button" onClick={() => setZoom((value) => Math.max(0.8, value - 0.2))} aria-label="Зменшити">−</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((value) => Math.min(1.8, value + 0.2))} aria-label="Збільшити">+</button>
        </div>
      </header>
      <div className="map-scroll" role="region" aria-label="Схема метро">
        <svg
          className="metro-map"
          viewBox="25 10 910 690"
          style={{ width: `${920 * zoom}px` }}
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
            const label = labelPosition(station.id, station.line)
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
                <text x={station.mapX + label.dx} y={station.mapY + label.dy} textAnchor={label.anchor} className="station-label">
                  {station.name}
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
        <span className="map-tip"><Icon name="info" size={15} /> Натисніть на станцію</span>
      </footer>
    </section>
  )
}
