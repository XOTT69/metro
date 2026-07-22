import { useEffect, useMemo, useState } from 'react'
import { lines, stationById } from '../data/metro'
import { useLanguage } from '../lib/i18n'
import { formatCountdown, getHeadwayMinutes, getNextTrainSeconds } from '../lib/metro'
import {
  formatOfficialInterval,
  getNextFirstTrain,
  getOfficialDirectionTimes,
  getOfficialIntervalSeconds,
  getOfficialNextTrainSeconds,
  getOfficialStationSchedule,
  useOfficialSchedule,
} from '../lib/officialSchedule'
import type { RoutePlan } from '../types'
import { Icon } from './Icon'

interface Props {
  route: RoutePlan
  onOpenStation: (stationId: string) => void
}

const formatSeconds = (seconds: number | null) => {
  if (seconds === null) return '—'
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

export const RouteDeparturePanel = ({ route, onOpenStation }: Props) => {
  const { language, locale, stationName, terminalName } = useLanguage()
  const scheduleState = useOfficialSchedule()
  const [now, setNow] = useState(() => new Date())
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    const refresh = () => setNow(new Date())
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  const firstRide = useMemo(() => route.steps.find((step) => step.type === 'ride' && step.line), [route])
  if (!firstRide?.line) return null

  const departureStation = stationById.get(firstRide.from) ?? route.from
  const line = lines[firstRide.line]
  const fromIndex = line.stationIds.indexOf(firstRide.from)
  const toIndex = line.stationIds.indexOf(firstRide.to)
  const towardEnd = toIndex > fromIndex
  const direction = terminalName(firstRide.line, towardEnd ? 'end' : 'start')

  const officialData = scheduleState.status === 'ready' ? scheduleState.data : null
  const nextSeconds = officialData
    ? getOfficialNextTrainSeconds(officialData, departureStation, towardEnd, now)
    : getNextTrainSeconds(departureStation, towardEnd, now)
  const followingSeconds = officialData
    ? getOfficialNextTrainSeconds(officialData, departureStation, towardEnd, now, 1)
    : nextSeconds === null ? null : nextSeconds + Math.round(getHeadwayMinutes(departureStation.line, now) * 60)
  const officialInterval = officialData ? getOfficialIntervalSeconds(officialData, departureStation.line, towardEnd, now) : null
  const stationSchedule = officialData ? getOfficialStationSchedule(officialData, departureStation.id) : null
  const directionTimes = officialData ? getOfficialDirectionTimes(officialData, departureStation, towardEnd) : null
  const nextFirst = officialData && nextSeconds === null ? getNextFirstTrain(officialData, departureStation, towardEnd, now) : null

  const arrivalTime = nextSeconds === null
    ? null
    : new Date(now.getTime() + (nextSeconds + route.totalMinutes * 60) * 1000).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })

  const isOfficial = Boolean(officialData)
  const sourceLabel = scheduleState.status === 'loading'
    ? (language === 'uk' ? 'Завантажуємо офіційний графік…' : 'Loading the official schedule…')
    : isOfficial
      ? (language === 'uk' ? 'Офіційний погодинний графік Києва' : 'Official Kyiv hourly schedule')
      : (language === 'uk' ? 'Резервний розрахунок' : 'Fallback estimate')

  return (
    <section className={`departure-panel ${expanded ? 'is-expanded' : ''}`} aria-live="polite">
      <button type="button" className="departure-panel-main" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
        <span className="departure-status-dot" data-official={isOfficial ? 'true' : 'false'} />
        <span className="departure-panel-copy">
          <small>{language === 'uk' ? `Наступний поїзд від «${stationName(departureStation)}»` : `Next train from ${stationName(departureStation)}`}</small>
          <strong>{nextSeconds === null ? (language === 'uk' ? 'Рух завершено' : 'Service ended') : formatSeconds(nextSeconds)}</strong>
          <span>{language === 'uk' ? 'У напрямку' : 'Towards'} {direction}</span>
        </span>
        <span className="departure-panel-side">
          {followingSeconds !== null && <span><small>{language === 'uk' ? 'Після нього' : 'Following'}</small><b>{formatSeconds(followingSeconds)}</b></span>}
          <Icon name="chevron" size={19} />
        </span>
      </button>

      <div className="departure-panel-meta">
        <span><Icon name="clock" size={15} /> {arrivalTime ? `${language === 'uk' ? 'Прибуття' : 'Arrival'} ${arrivalTime}` : nextFirst ? `${language === 'uk' ? 'Перший поїзд' : 'First train'} ${nextFirst.date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}` : (language === 'uk' ? 'Час наступного рейсу уточнюється' : 'Next service time unavailable')}</span>
        <span>{sourceLabel}</span>
      </div>

      {expanded && (
        <div className="departure-panel-details">
          <div className="departure-detail-grid">
            <span><small>{language === 'uk' ? 'Інтервал' : 'Interval'}</small><strong>{isOfficial ? formatOfficialInterval(officialInterval) : `${getHeadwayMinutes(departureStation.line, now) || '—'} ${language === 'uk' ? 'хв' : 'min'}`}</strong></span>
            <span><small>{language === 'uk' ? 'Відкриття' : 'Opens'}</small><strong>{stationSchedule?.open || '—'}</strong></span>
            <span><small>{language === 'uk' ? 'Закриття' : 'Closes'}</small><strong>{stationSchedule?.close || '—'}</strong></span>
            <span><small>{language === 'uk' ? 'Останній поїзд' : 'Last train'}</small><strong>{directionTimes?.last.at(-1) || '—'}</strong></span>
          </div>
          <p><Icon name="info" size={16} /> {language === 'uk'
            ? 'Секунди синхронізуються з офіційним погодинним інтервалом та розрахунковим часом проходження станцій. Це не GPS-відстеження конкретного поїзда; під час тривог або оперативних змін фактичний час може відрізнятися.'
            : 'Seconds are synchronized with the official hourly interval and calculated station travel times. This is not GPS tracking of a specific train; disruptions may change the actual time.'}</p>
          <button type="button" className="departure-station-link" onClick={() => onOpenStation(departureStation.id)}>
            <span>{language === 'uk' ? 'Усі деталі станції та розклад' : 'Full station details and schedule'}</span>
            <Icon name="chevron" size={18} />
          </button>
        </div>
      )}
    </section>
  )
}
