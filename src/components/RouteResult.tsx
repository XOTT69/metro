import { useEffect, useState } from 'react'
import { lines, stationById } from '../data/metro'
import { useLanguage } from '../lib/i18n'
import { getDirectionName } from '../lib/metro'
import type { RoutePlan, RoutePreference } from '../types'
import { Icon } from './Icon'

interface Props {
  route: RoutePlan
  onStationClick: (stationId: string) => void
  onShare: () => void
}

export const RouteResult = ({ route, onStationClick, onShare }: Props) => {
  const { locale, t, stationName, lineName, terminalName, minuteLabel, stationCount, transferCount } = useLanguage()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(timer)
  }, [])

  const arrivalTime = new Date(now + route.totalMinutes * 60000).toLocaleTimeString(locale, {
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
          <span className="eyebrow route-endpoints">{stationName(route.from)} → {stationName(route.to)}</span>
          <div className="route-time"><strong>{route.totalMinutes}</strong><span>{minuteLabel}</span></div>
        </div>
        <div className="route-actions">
          <button className="primary-button compact-button" type="button" onClick={startTrip}>
            <Icon name="train" size={18} /> {t('startTrip')}
          </button>
          <button className="secondary-button compact-button" type="button" onClick={onShare}>
            <Icon name="share" size={18} /> {t('share')}
          </button>
        </div>
      </header>

      <div className="route-mode-switch" aria-label={t('routeMode')}>
        <button
          type="button"
          className={route.preference === 'fastest' ? 'active' : ''}
          onClick={() => changePreference('fastest')}
          aria-pressed={route.preference === 'fastest'}
        >
          <strong>{t('fastest')}</strong>
          <small>{t('fastestHint')}</small>
        </button>
        <button
          type="button"
          className={route.preference === 'fewest-transfers' ? 'active' : ''}
          onClick={() => changePreference('fewest-transfers')}
          aria-pressed={route.preference === 'fewest-transfers'}
        >
          <strong>{t('fewerTransfers')}</strong>
          <small>{t('fewerTransfersHint')}</small>
        </button>
      </div>

      <div className="route-stats" aria-label={t('routeStats')}>
        <span><Icon name="clock" size={17} /> {t('arrivalAt')} {arrivalTime}</span>
        <span><Icon name="train" size={17} /> {stationCount(route.stationCount)}</span>
        <span><Icon name="refresh" size={17} /> {transferCount(route.transferCount)}</span>
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
                  <strong>{t('changeTo')} {lineName(to.line)}</strong>
                  <small>{t('transitionAbout')} {Math.round(step.minutes)} {minuteLabel}</small>
                </div>
              </div>
            )
          }

          const rawDirection = getDirectionName(step.line!, step.from, step.to)
          const direction = rawDirection === lines[step.line!].terminalStart
            ? terminalName(step.line!, 'start')
            : terminalName(step.line!, 'end')
          return (
            <div className="timeline-ride" key={`${step.from}-${step.to}-${index}`}>
              <div className="ride-heading">
                <span className="line-pill" style={{ background: lines[step.line!].color }}>{step.line}</span>
                <div>
                  <strong>{t('directionTo')} “{direction}”</strong>
                  <small>{stationCount(Math.max(1, step.stationIds.length - 1))} · {Math.round(step.minutes)} {minuteLabel}</small>
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
                      <span>{stationName(station)}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <p className="data-note"><Icon name="info" size={16} /> {t('estimatedTimeNote')}</p>
    </section>
  )
}
