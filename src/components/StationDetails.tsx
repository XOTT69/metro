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
  OFFICIAL_SCHEDULE_SOURCE,
  useOfficialSchedule,
} from '../lib/officialSchedule'
import type { Station } from '../types'
import { Icon } from './Icon'

interface Props {
  station: Station
  isFavorite: boolean
  onToggleFavorite: () => void
  onClose: () => void
  onSetAsFrom: () => void
  onSetAsTo: () => void
  onOpenStation?: (stationId: string) => void
}

const joinTimes = (times?: string[]) => times?.length ? times.join(' · ') : '—'

export const StationDetails = ({
  station,
  isFavorite,
  onToggleFavorite,
  onClose,
  onSetAsFrom,
  onSetAsTo,
  onOpenStation,
}: Props) => {
  const { language, t, stationName, lineName, terminalName, minuteLabel } = useLanguage()
  const [, setTick] = useState(0)
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied'>('idle')
  const scheduleState = useOfficialSchedule()
  const line = lines[station.line]
  const index = line.stationIds.indexOf(station.id)
  const previousStation = index > 0 ? stationById.get(line.stationIds[index - 1]) : undefined
  const nextStation = index < line.stationIds.length - 1 ? stationById.get(line.stationIds[index + 1]) : undefined
  const transfers = useMemo(
    () => station.transferTo?.map((id) => stationById.get(id)).filter(Boolean) as Station[] | undefined,
    [station.transferTo],
  )

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000)
    const refresh = () => setTick((value) => value + 1)
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [onClose])

  useEffect(() => setShareStatus('idle'), [station.id])

  const officialData = scheduleState.status === 'ready' ? scheduleState.data : null
  const stationSchedule = officialData ? getOfficialStationSchedule(officialData, station.id) : null

  const countdown = (towardEnd: boolean, ordinal = 0) => officialData
    ? getOfficialNextTrainSeconds(officialData, station, towardEnd, new Date(), ordinal)
    : ordinal === 0
      ? getNextTrainSeconds(station, towardEnd)
      : (() => {
          const first = getNextTrainSeconds(station, towardEnd)
          return first === null ? null : first + Math.round(getHeadwayMinutes(station.line) * 60)
        })()

  const directionInfo = (towardEnd: boolean) => {
    const next = countdown(towardEnd)
    const after = countdown(towardEnd, 1)
    const interval = officialData ? getOfficialIntervalSeconds(officialData, station.line, towardEnd) : null
    const times = officialData ? getOfficialDirectionTimes(officialData, station, towardEnd) : null
    const firstNextDay = officialData && next === null ? getNextFirstTrain(officialData, station, towardEnd) : null
    return { next, after, interval, times, firstNextDay }
  }

  const shareStation = async () => {
    const url = new URL(window.location.href)
    url.searchParams.set('tab', 'map')
    url.searchParams.set('station', station.id)
    const text = `${t('station')} “${stationName(station)}” — ${lineName(station.line)}`
    try {
      if (navigator.share) await navigator.share({ title: `${stationName(station)} — ${t('appName')}`, text, url: url.toString() })
      else {
        await navigator.clipboard.writeText(`${text}\n${url.toString()}`)
        setShareStatus('copied')
        window.setTimeout(() => setShareStatus('idle'), 1800)
      }
    } catch {
      // Native share sheet may be dismissed by the user.
    }
  }

  const openRelatedStation = (stationId: string) => {
    if (onOpenStation) { onOpenStation(stationId); return }
    const url = new URL(window.location.href)
    url.searchParams.set('tab', 'map')
    url.searchParams.set('station', stationId)
    window.location.assign(url.toString())
  }

  const mapUrl = `https://www.openstreetmap.org/?mlat=${station.lat}&mlon=${station.lng}#map=17/${station.lat}/${station.lng}`

  const DirectionCard = ({ towardEnd }: { towardEnd: boolean }) => {
    const terminal = terminalName(station.line, towardEnd ? 'end' : 'start')
    const info = directionInfo(towardEnd)
    return (
      <article className="station-direction-card official-direction-card card">
        <div className="direction-card-heading">
          <span>{language === 'uk' ? 'У напрямку' : 'Towards'}</span>
          <strong>{terminal}</strong>
        </div>
        <div className="direction-countdowns">
          <span><small>{language === 'uk' ? 'Наступний' : 'Next'}</small><b>{info.next === null ? '—' : formatCountdown(info.next)}</b></span>
          <span><small>{language === 'uk' ? 'Після нього' : 'Following'}</small><b>{info.after === null ? '—' : formatCountdown(info.after)}</b></span>
        </div>
        {info.next === null && info.firstNextDay && (
          <p className="next-service-note">{language === 'uk' ? 'Перший наступний рейс' : 'Next first service'} — {info.firstNextDay.time}</p>
        )}
        <div className="direction-schedule-grid">
          <span><small>{language === 'uk' ? 'Інтервал' : 'Interval'}</small><strong>{officialData ? formatOfficialInterval(info.interval) : `${getHeadwayMinutes(station.line) || '—'} ${minuteLabel}`}</strong></span>
          <span><small>{language === 'uk' ? 'Перші поїзди' : 'First trains'}</small><strong>{joinTimes(info.times?.first)}</strong></span>
          <span><small>{language === 'uk' ? 'Останні поїзди' : 'Last trains'}</small><strong>{joinTimes(info.times?.last)}</strong></span>
        </div>
      </article>
    )
  }

  return (
    <section className="station-page station-bottom-sheet" role="dialog" aria-modal="true" aria-label={`${t('station')} ${stationName(station)}`}>
      <button type="button" className="station-sheet-backdrop" onClick={onClose} aria-label={t('close')} />
      <div className="station-sheet-panel">
        <header className="station-page-topbar">
          <button type="button" className="station-page-back" onClick={onClose} aria-label={t('back')}><Icon name="arrow" size={21} /></button>
          <span className="station-page-top-title">{t('station')}</span>
          <div className="station-page-top-actions">
            <button type="button" className={`icon-button ${isFavorite ? 'is-favorite' : ''}`} onClick={onToggleFavorite} aria-label={isFavorite ? t('removeFavorite') : t('addFavorite')}><Icon name="star" /></button>
            <button type="button" className="icon-button" onClick={shareStation} aria-label={t('shareStation')}><Icon name={shareStatus === 'copied' ? 'check' : 'share'} /></button>
          </div>
        </header>

        <div className="station-page-scroll">
          <section className="station-hero compact-station-hero" style={{ '--station-line': line.color } as React.CSSProperties}>
            <div className="station-hero-glow" />
            <div className="station-hero-content">
              <div className="station-hero-meta"><span className="line-pill station-line-pill" style={{ background: line.color }}>{station.line}</span><span>{station.code}</span></div>
              <h1>{stationName(station)}</h1>
              <p>{language === 'uk' ? station.nameEn : station.name}</p>
              <div className="station-line-name"><i style={{ background: line.color }} /> {lineName(station.line)}</div>
            </div>
          </section>

          <main className="station-page-content">
            <section className="station-route-actions card">
              <button type="button" className="primary-button" onClick={onSetAsFrom}><Icon name="location" size={19} /> {t('routeFromStation')}</button>
              <button type="button" className="secondary-button" onClick={onSetAsTo}><Icon name="arrow" size={19} /> {t('routeToStation')}</button>
            </section>

            <section className="station-section station-hours-section">
              <div className="station-section-heading">
                <div><span className="eyebrow">{language === 'uk' ? 'Офіційний режим' : 'Official hours'}</span><h2>{language === 'uk' ? 'Робота станції' : 'Station hours'}</h2></div>
                <span className={`calculated-badge ${officialData ? 'is-official' : ''}`}>{officialData ? (language === 'uk' ? 'Відкриті дані' : 'Open data') : t('calculated')}</span>
              </div>
              <div className="station-hours-card card">
                <span><Icon name="clock" size={20} /><small>{language === 'uk' ? 'Відкриття' : 'Opens'}</small><strong>{stationSchedule?.open || '—'}</strong></span>
                <span><Icon name="clock" size={20} /><small>{language === 'uk' ? 'Закриття' : 'Closes'}</small><strong>{stationSchedule?.close || '—'}</strong></span>
                <span><Icon name="route" size={20} /><small>{language === 'uk' ? 'Вестибюлі' : 'Entrances'}</small><strong>{stationSchedule?.hallsOpen ?? stationSchedule?.halls ?? '—'}{stationSchedule?.halls && stationSchedule.hallsOpen !== undefined ? `/${stationSchedule.halls}` : ''}</strong></span>
              </div>
            </section>

            <section className="station-section">
              <div className="station-section-heading">
                <div><span className="eyebrow">{t('trainMovement')}</span><h2>{t('nextTrain')}</h2></div>
                <span className={`calculated-badge ${officialData ? 'is-official' : ''}`}>{officialData ? (language === 'uk' ? 'Офіційний графік' : 'Official schedule') : t('calculated')}</span>
              </div>
              <div className="station-direction-grid">
                {previousStation && <DirectionCard towardEnd={false} />}
                {nextStation && <DirectionCard towardEnd />}
              </div>
              <p className="station-data-warning"><Icon name="info" size={17} /> {language === 'uk'
                ? 'Секундний таймер синхронізований з офіційним погодинним інтервалом і часом проходження станцій. Він не є GPS-відстеженням конкретного поїзда; оперативні зміни та повітряні тривоги можуть вплинути на фактичне прибуття.'
                : 'The seconds countdown is synchronized with the official hourly interval and station travel times. It is not GPS tracking of a specific train; disruptions may affect actual arrival.'}</p>
            </section>

            <section className="station-section">
              <div className="station-section-heading"><div><span className="eyebrow">{t('onLine')}</span><h2>{t('neighbouringStations')}</h2></div></div>
              <div className="station-neighbours card">
                {previousStation ? (
                  <button type="button" onClick={() => openRelatedStation(previousStation.id)}><Icon name="arrow" size={18} /><span><small>{t('previous')}</small><strong>{stationName(previousStation)}</strong></span></button>
                ) : <div className="station-neighbour-empty">{t('lineStart')}</div>}
                <span className="station-current-node" style={{ background: line.color }}><i /></span>
                {nextStation ? (
                  <button type="button" onClick={() => openRelatedStation(nextStation.id)}><span><small>{t('next')}</small><strong>{stationName(nextStation)}</strong></span><Icon name="arrow" size={18} /></button>
                ) : <div className="station-neighbour-empty">{t('lineEnd')}</div>}
              </div>
            </section>

            {transfers && transfers.length > 0 && (
              <section className="station-section">
                <div className="station-section-heading"><div><span className="eyebrow">{t('interchange')}</span><h2>{t('transfers')}</h2></div></div>
                <div className="station-transfer-list">
                  {transfers.map((target) => {
                    const targetLine = lines[target.line]
                    return (
                      <button type="button" className="station-transfer-card card" key={target.id} onClick={() => openRelatedStation(target.id)}>
                        <span className="line-pill" style={{ background: targetLine.color }}>{target.line}</span>
                        <span><strong>{stationName(target)}</strong><small>{lineName(target.line)}</small></span><Icon name="chevron" size={19} />
                      </button>
                    )
                  })}
                </div>
              </section>
            )}

            <section className="station-section">
              <div className="station-section-heading"><div><span className="eyebrow">{t('location')}</span><h2>{t('stationOnMap')}</h2></div></div>
              <a className="station-map-card card" href={mapUrl} target="_blank" rel="noreferrer">
                <span className="station-map-icon"><Icon name="map" /></span><span><strong>{t('openCoordinates')}</strong><small>{station.lat.toFixed(5)}, {station.lng.toFixed(5)}</small></span><Icon name="chevron" />
              </a>
            </section>

            <a className="station-source-card card official-source-link" href={OFFICIAL_SCHEDULE_SOURCE.url} target="_blank" rel="noreferrer">
              <Icon name="info" size={20} />
              <div><strong>{language === 'uk' ? 'Джерело розкладу' : 'Schedule source'}</strong><p>{OFFICIAL_SCHEDULE_SOURCE.title}</p></div>
              <Icon name="chevron" size={18} />
            </a>
          </main>
        </div>
      </div>
    </section>
  )
}
