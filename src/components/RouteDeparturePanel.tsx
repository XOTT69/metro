import { useEffect, useMemo, useState } from 'react'
import { lines, stationById } from '../data/metro'
import { useLanguage } from '../lib/i18n'
import { getHeadwayMinutes, getNextTrainSeconds } from '../lib/metro'
import {
  getNextFirstTrain,
  getOfficialDirectionTimes,
  getOfficialNextTrainSeconds,
  getOfficialStationSchedule,
  parseClockSeconds,
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
  return `${minutes.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`
}

const formatClock = (date: Date, locale: string) => date.toLocaleTimeString(locale, {
  hour: '2-digit',
  minute: '2-digit',
})

const isOpenAt = (open: string | undefined, close: string | undefined, date: Date) => {
  const openSeconds = parseClockSeconds(open)
  const closeSeconds = parseClockSeconds(close)
  if (openSeconds === null || closeSeconds === null) return null
  const nowSeconds = date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds()
  return closeSeconds <= openSeconds
    ? nowSeconds >= openSeconds || nowSeconds <= closeSeconds
    : nowSeconds >= openSeconds && nowSeconds <= closeSeconds
}

export const RouteDeparturePanel = ({ route, onOpenStation }: Props) => {
  const { language, locale, stationName, terminalName } = useLanguage()
  const scheduleState = useOfficialSchedule()
  const [now, setNow] = useState(() => new Date())

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
  const stationSchedule = officialData ? getOfficialStationSchedule(officialData, departureStation.id) : null
  const directionTimes = officialData ? getOfficialDirectionTimes(officialData, departureStation, towardEnd) : null
  const nextFirst = officialData && nextSeconds === null
    ? getNextFirstTrain(officialData, departureStation, towardEnd, now)
    : null

  const arrivalTime = nextSeconds === null
    ? null
    : formatClock(new Date(now.getTime() + (nextSeconds + route.totalMinutes * 60) * 1000), locale)
  const nextFirstTime = nextFirst ? formatClock(nextFirst.date, locale) : null
  const firstTrain = directionTimes?.first[0] ?? '—'
  const lastTrain = directionTimes?.last.at(-1) ?? '—'
  const openState = isOpenAt(stationSchedule?.open, stationSchedule?.close, now)
  const openLabel = openState === null
    ? (language === 'uk' ? 'Режим роботи' : 'Opening hours')
    : openState
      ? (language === 'uk' ? 'Відкрито' : 'Open')
      : (language === 'uk' ? 'Зачинено' : 'Closed')

  const primaryLabel = nextSeconds === null && nextFirstTime
    ? (language === 'uk' ? 'Перший поїзд о' : 'First train at')
    : (language === 'uk' ? 'Наступний поїзд через' : 'Next train in')
  const primaryValue = nextSeconds === null ? (nextFirstTime ?? '—') : formatSeconds(nextSeconds)
  const sourceLabel = scheduleState.status === 'loading'
    ? (language === 'uk' ? 'Завантажуємо офіційний графік…' : 'Loading the official schedule…')
    : officialData
      ? (language === 'uk' ? 'За офіційним графіком, не live-GPS' : 'Official timetable, not live GPS')
      : (language === 'uk' ? 'Резервний розрахунок, не live-GPS' : 'Fallback estimate, not live GPS')

  return (
    <section className="route-live-stack" aria-live="polite">
      <article className="departure-panel departure-overview-card card">
        <div className="departure-metrics">
          <div className="departure-primary-metric">
            <span className="departure-train-badge"><Icon name="train" size={25} /></span>
            <span className="departure-primary-copy">
              <small>{primaryLabel}</small>
              <strong>{primaryValue}</strong>
            </span>
          </div>

          <span className="departure-secondary-metric">
            <small>{language === 'uk' ? 'Після нього' : 'Following'}</small>
            <strong>{formatSeconds(followingSeconds)}</strong>
          </span>

          <span className="departure-secondary-metric">
            <small>{language === 'uk' ? 'Прибуття орієнтовно' : 'Estimated arrival'}</small>
            <strong>{arrivalTime ?? '—'}</strong>
          </span>
        </div>

        <div className="departure-source-note">
          <Icon name="info" size={16} />
          <span>{sourceLabel}</span>
        </div>
      </article>

      <button
        type="button"
        className="service-hours-card card"
        onClick={() => onOpenStation(departureStation.id)}
        aria-label={language === 'uk' ? `Відкрити розклад станції ${stationName(departureStation)}` : `Open ${stationName(departureStation)} schedule`}
      >
        <span className="service-hour-item">
          <small>{openLabel}</small>
          <strong>{stationSchedule?.open ?? '—'}</strong>
          <em><Icon name="sun" size={17} /> {stationSchedule?.close ? `${language === 'uk' ? 'до' : 'until'} ${stationSchedule.close}` : stationName(departureStation)}</em>
        </span>

        <span className="service-hour-item">
          <small>{language === 'uk' ? 'Перший поїзд' : 'First train'}</small>
          <strong>{firstTrain}</strong>
          <em><Icon name="arrow" size={16} /> {language === 'uk' ? 'до' : 'to'} {direction}</em>
        </span>

        <span className="service-hour-item">
          <small>{language === 'uk' ? 'Останній поїзд' : 'Last train'}</small>
          <strong>{lastTrain}</strong>
          <em><Icon name="moon" size={16} /> {language === 'uk' ? 'до' : 'to'} {direction}</em>
        </span>

        <Icon name="chevron" size={18} className="service-hours-chevron" />
      </button>
    </section>
  )
}
