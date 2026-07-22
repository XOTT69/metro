import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { lines, stationById } from '../data/metro'
import { useLanguage } from '../lib/i18n'
import { formatHeadwayRange, getHeadwayEstimate, getUpcomingTrainSeconds, HEADWAY_SOURCE } from '../lib/service'
import { Icon } from './Icon'

interface Props {
  hidden?: boolean
}

const stationFromRoute = () => {
  const stationId = new URL(window.location.href).searchParams.get('from')
  return stationById.get(stationId ?? '') ?? stationById.get('vokzalna')!
}

const formatTrainCountdown = (seconds: number | null, language: 'uk' | 'en') => {
  if (seconds === null) return '—'
  if (seconds < 60) return `${Math.max(1, seconds)} ${language === 'uk' ? 'с' : 's'}`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`
}

const useTopbarTarget = () => {
  const [target, setTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const sync = () => {
      const next = document.querySelector<HTMLElement>('.topbar-actions')
      setTarget((current) => current === next ? current : next)
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { subtree: true, childList: true })
    return () => observer.disconnect()
  }, [])

  return target
}

export const ServiceBoard = ({ hidden = false }: Props) => {
  const { language, stationName, terminalName } = useLanguage()
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const topbarTarget = useTopbarTarget()
  const station = stationFromRoute()
  const line = lines[station.line]
  const estimate = getHeadwayEstimate(station.line, now)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (hidden) setOpen(false)
  }, [hidden])

  const directions = useMemo(() => ([
    { towardEnd: false, terminal: terminalName(station.line, 'start') },
    { towardEnd: true, terminal: terminalName(station.line, 'end') },
  ]), [station.line, terminalName])

  if (hidden) return null

  const firstTrain = getUpcomingTrainSeconds(station, true, 1, now)[0]
  const ended = !estimate
  const countdown = ended
    ? (language === 'uk' ? 'Стоп' : 'Ended')
    : formatTrainCountdown(firstTrain, language)

  const topbarButton = (
    <button
      type="button"
      className="topbar-train-button"
      onClick={() => setOpen(true)}
      aria-label={language === 'uk'
        ? `Таймер поїзда зі станції ${stationName(station)}: ${countdown}`
        : `Train countdown from ${stationName(station)}: ${countdown}`}
      title={language === 'uk' ? 'Інтервали та прибуття поїздів' : 'Train intervals and arrivals'}
    >
      <span className="topbar-train-icon" style={{ background: line.color }}><Icon name="clock" size={15} /></span>
      <span className="topbar-train-copy"><small>{stationName(station)}</small><strong>{countdown}</strong></span>
    </button>
  )

  return (
    <>
      {topbarTarget && createPortal(topbarButton, topbarTarget)}

      {open && (
        <div className="service-board-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section className="service-board-panel" role="dialog" aria-modal="true" aria-label={language === 'uk' ? 'Інтервали та прибуття поїздів' : 'Train intervals and arrivals'}>
            <header>
              <div>
                <span className="eyebrow">{language === 'uk' ? 'Розрахунок за офіційними інтервалами' : 'Estimate based on official headways'}</span>
                <h2>{stationName(station)}</h2>
                <p><span className="line-pill" style={{ background: line.color }}>{line.id}</span> {language === 'uk' ? line.name : line.nameEn}</p>
              </div>
              <button type="button" className="icon-button" onClick={() => setOpen(false)} aria-label={language === 'uk' ? 'Закрити' : 'Close'}><Icon name="close" /></button>
            </header>

            <div className="service-board-summary">
              <span><small>{language === 'uk' ? 'Поточний інтервал' : 'Current headway'}</small><strong>{formatHeadwayRange(estimate, language)}</strong></span>
              <span><small>{language === 'uk' ? 'Режим' : 'Service period'}</small><strong>{estimate?.period === 'weekday-peak' ? (language === 'uk' ? 'Будній пік' : 'Weekday peak') : estimate?.period === 'weekday-offpeak' ? (language === 'uk' ? 'Будній міжпік' : 'Weekday off-peak') : estimate?.period === 'weekend' ? (language === 'uk' ? 'Вихідний' : 'Weekend') : (language === 'uk' ? 'Завершено' : 'Ended')}</strong></span>
            </div>

            <div className="service-direction-grid">
              {directions.map(({ towardEnd, terminal }) => {
                const arrivals = getUpcomingTrainSeconds(station, towardEnd, 2, now)
                return (
                  <article className="service-direction-card" key={String(towardEnd)}>
                    <span>{language === 'uk' ? 'У напрямку' : 'Towards'}</span>
                    <h3>{terminal}</h3>
                    <div className="service-arrival-times">
                      <span><small>{language === 'uk' ? 'Наступний' : 'Next'}</small><strong>{formatTrainCountdown(arrivals[0], language)}</strong></span>
                      <span><small>{language === 'uk' ? 'Після нього' : 'Following'}</small><strong>{formatTrainCountdown(arrivals[1], language)}</strong></span>
                    </div>
                  </article>
                )
              })}
            </div>

            <p className="service-board-warning"><Icon name="info" size={17} /> {language === 'uk' ? 'Це не live-відстеження. Таймер синхронізовано з типовим інтервалом і розрахунковим часом проходження станцій. Під час збоїв, тривог або змін графіка фактичне прибуття може відрізнятися.' : 'This is not live tracking. The timer uses the typical headway and estimated travel between stations. Actual arrivals may differ during disruptions, alerts or timetable changes.'}</p>

            <footer>
              <span className="service-source-links">
                <a href={HEADWAY_SOURCE.url} target="_blank" rel="noreferrer">{language === 'uk' ? 'Джерело КМДА · 23.06.2026' : 'Kyiv City source · 23 Jun 2026'} <Icon name="chevron" size={16} /></a>
                <a href="./sources.html">{language === 'uk' ? 'Методика' : 'Methodology'}</a>
                <a href="./privacy.html">{language === 'uk' ? 'Конфіденційність' : 'Privacy'}</a>
              </span>
              <button type="button" className="secondary-button compact-button" onClick={() => {
                const url = new URL(window.location.href)
                url.searchParams.set('tab', 'stations')
                url.searchParams.set('station', station.id)
                window.location.assign(url.toString())
              }}>{language === 'uk' ? 'Відкрити станцію' : 'Open station'}</button>
            </footer>
          </section>
        </div>
      )}
    </>
  )
}
