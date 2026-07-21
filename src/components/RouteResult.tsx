import { useEffect, useState } from 'react'
import { lines, stationById } from '../data/metro'
import { getDirectionName } from '../lib/metro'
import type { RoutePlan, RoutePreference } from '../types'
import { Icon } from './Icon'

interface Props {
  route: RoutePlan
  onStationClick: (stationId: string) => void
  onShare: () => void
}

const transferLabel = (count: number) => {
  if (count === 0) return 'Без пересадок'
  if (count === 1) return '1 пересадка'
  return `${count} пересадки`
}

export const RouteResult = ({ route, onStationClick, onShare }: Props) => {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(timer)
  }, [])

  const arrivalTime = new Date(now + route.totalMinutes * 60000).toLocaleTimeString('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const changePreference = (preference: RoutePreference) => {
    window.localStorage.setItem('metro-route-preference', JSON.stringify(preference))
    window.dispatchEvent(new CustomEvent<RoutePreference>('metro-route-preference', { detail: preference }))
  }

  const startTrip = () => {
    window.dispatchEvent(new CustomEvent<RoutePlan>('metro-start-trip', { detail: route }))
  }

  return (
    <section className="route-result card" aria-live="polite">
      <header className="route-summary">
        <div>
          <span className="eyebrow route-endpoints">{route.from.name} → {route.to.name}</span>
          <div className="route-time"><strong>{route.totalMinutes}</strong><span>хв</span></div>
        </div>
        <div className="route-actions">
          <button className="primary-button compact-button" type="button" onClick={startTrip}>
            <Icon name="train" size={18} /> Почати поїздку
          </button>
          <button className="secondary-button compact-button" type="button" onClick={onShare}>
            <Icon name="share" size={18} /> Поділитися
          </button>
        </div>
      </header>

      <div className="route-mode-switch" aria-label="Режим побудови маршруту">
        <button
          type="button"
          className={route.preference === 'fastest' ? 'active' : ''}
          onClick={() => changePreference('fastest')}
          aria-pressed={route.preference === 'fastest'}
        >
          <strong>Найшвидший</strong>
          <small>Мінімальний час у дорозі</small>
        </button>
        <button
          type="button"
          className={route.preference === 'fewest-transfers' ? 'active' : ''}
          onClick={() => changePreference('fewest-transfers')}
          aria-pressed={route.preference === 'fewest-transfers'}
        >
          <strong>Менше пересадок</strong>
          <small>Простіший маршрут, іноді довший</small>
        </button>
      </div>

      <div className="route-stats" aria-label="Параметри маршруту">
        <span><Icon name="clock" size={17} /> Прибуття о {arrivalTime}</span>
        <span><Icon name="train" size={17} /> {route.stationCount} станцій</span>
        <span><Icon name="refresh" size={17} /> {transferLabel(route.transferCount)}</span>
      </div>

      <div className="timeline">
        {route.steps.map((step, index) => {
          const from = stationById.get(step.from)
          const to = stationById.get(step.to)
          if (!from || !to) return null

          if (step.type === 'transfer') {
            return (
              <div className="timeline-transfer" key={`${step.from}-${step.to}`}>
                <span className="timeline-connector dotted" />
                <div className="transfer-icon"><Icon name="refresh" size={16} /></div>
                <div>
                  <strong>Пересісти на {lines[to.line].name}</strong>
                  <small>Перехід приблизно {Math.round(step.minutes)} хв</small>
                </div>
              </div>
            )
          }

          const direction = getDirectionName(step.line!, step.from, step.to)
          return (
            <div className="timeline-ride" key={`${step.from}-${step.to}-${index}`}>
              <div className="ride-heading">
                <span className="line-pill" style={{ background: lines[step.line!].color }}>{step.line}</span>
                <div>
                  <strong>У напрямку «{direction}»</strong>
                  <small>{Math.max(1, step.stationIds.length - 1)} станцій · {Math.round(step.minutes)} хв</small>
                </div>
              </div>
              <div className="ride-stations" style={{ '--line-color': lines[step.line!].color } as React.CSSProperties}>
                {step.stationIds.map((stationId, stationIndex) => {
                  const station = stationById.get(stationId)
                  if (!station) return null
                  const isEndpoint = stationIndex === 0 || stationIndex === step.stationIds.length - 1
                  return (
                    <button
                      type="button"
                      className={`ride-station ${isEndpoint ? 'endpoint' : ''}`}
                      key={stationId}
                      onClick={() => onStationClick(stationId)}
                    >
                      <span className="route-node" />
                      <span>{station.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <p className="data-note"><Icon name="info" size={16} /> Час орієнтовний і враховує середній рух та переходи між лініями.</p>
    </section>
  )
}
