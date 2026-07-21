import { useEffect, useMemo, useState } from 'react'
import { lines, stationById } from '../data/metro'
import { useLanguage } from '../lib/i18n'
import { formatCountdown, getHeadwayMinutes, getNextTrainSeconds } from '../lib/metro'
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
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  useEffect(() => {
    setShareStatus('idle')
  }, [station.id])

  const shareStation = async () => {
    const url = new URL(window.location.href)
    url.searchParams.set('tab', 'stations')
    url.searchParams.set('station', station.id)
    url.searchParams.delete('from')
    url.searchParams.delete('to')
    const text = `${t('station')} “${stationName(station)}” — ${lineName(station.line)}`

    try {
      if (navigator.share) {
        await navigator.share({ title: `${stationName(station)} — ${t('appName')}`, text, url: url.toString() })
      } else {
        await navigator.clipboard.writeText(`${text}\n${url.toString()}`)
        setShareStatus('copied')
        window.setTimeout(() => setShareStatus('idle'), 1800)
      }
    } catch {
      // The user may close the native sharing dialog.
    }
  }

  const openRelatedStation = (stationId: string) => {
    if (onOpenStation) {
      onOpenStation(stationId)
      return
    }
    const url = new URL(window.location.href)
    url.searchParams.set('tab', 'stations')
    url.searchParams.set('station', stationId)
    window.location.assign(url.toString())
  }

  const mapUrl = `https://www.openstreetmap.org/?mlat=${station.lat}&mlon=${station.lng}#map=17/${station.lat}/${station.lng}`

  return (
    <section className="station-page" role="dialog" aria-modal="true" aria-label={`${t('station')} ${stationName(station)}`}>
      <header className="station-page-topbar">
        <button type="button" className="station-page-back" onClick={onClose} aria-label={t('back')}>
          <Icon name="arrow" size={21} />
        </button>
        <span className="station-page-top-title">{t('station')}</span>
        <div className="station-page-top-actions">
          <button type="button" className={`icon-button ${isFavorite ? 'is-favorite' : ''}`} onClick={onToggleFavorite} aria-label={isFavorite ? t('removeFavorite') : t('addFavorite')}>
            <Icon name="star" />
          </button>
          <button type="button" className="icon-button" onClick={shareStation} aria-label={t('shareStation')}>
            <Icon name={shareStatus === 'copied' ? 'check' : 'share'} />
          </button>
        </div>
      </header>

      <div className="station-page-scroll">
        <section className="station-hero" style={{ '--station-line': line.color } as React.CSSProperties}>
          <div className="station-hero-glow" />
          <div className="station-hero-content">
            <div className="station-hero-meta">
              <span className="line-pill station-line-pill" style={{ background: line.color }}>{station.line}</span>
              <span>{station.code}</span>
            </div>
            <h1>{stationName(station)}</h1>
            <p>{language === 'uk' ? station.nameEn : station.name}</p>
            <div className="station-line-name"><i style={{ background: line.color }} /> {lineName(station.line)}</div>
          </div>
        </section>

        <main className="station-page-content">
          <section className="station-route-actions card">
            <button type="button" className="primary-button" onClick={onSetAsFrom}>
              <Icon name="location" size={19} /> {t('routeFromStation')}
            </button>
            <button type="button" className="secondary-button" onClick={onSetAsTo}>
              <Icon name="arrow" size={19} /> {t('routeToStation')}
            </button>
          </section>

          <section className="station-section">
            <div className="station-section-heading">
              <div><span className="eyebrow">{t('trainMovement')}</span><h2>{t('nextTrain')}</h2></div>
              <span className="calculated-badge">{t('calculated')}</span>
            </div>

            <div className="station-direction-grid">
              {previousStation ? (
                <article className="station-direction-card card">
                  <span>{t('inDirection')}</span>
                  <strong>{terminalName(station.line, 'start')}</strong>
                  <b>{formatCountdown(getNextTrainSeconds(station, false))}</b>
                  <small>{t('typicalInterval')} — {getHeadwayMinutes(station.line) || '—'} {minuteLabel}</small>
                </article>
              ) : (
                <article className="station-direction-card terminal card">
                  <span>{t('terminalStation')}</span>
                  <strong>{terminalName(station.line, 'start')}</strong>
                  <small>{t('reverseDirection')}</small>
                </article>
              )}

              {nextStation ? (
                <article className="station-direction-card card">
                  <span>{t('inDirection')}</span>
                  <strong>{terminalName(station.line, 'end')}</strong>
                  <b>{formatCountdown(getNextTrainSeconds(station, true))}</b>
                  <small>{t('typicalInterval')} — {getHeadwayMinutes(station.line) || '—'} {minuteLabel}</small>
                </article>
              ) : (
                <article className="station-direction-card terminal card">
                  <span>{t('terminalStation')}</span>
                  <strong>{terminalName(station.line, 'end')}</strong>
                  <small>{t('reverseDirection')}</small>
                </article>
              )}
            </div>
            <p className="station-data-warning"><Icon name="info" size={17} /> {t('timersWarning')}</p>
          </section>

          <section className="station-section">
            <div className="station-section-heading"><div><span className="eyebrow">{t('onLine')}</span><h2>{t('neighbouringStations')}</h2></div></div>
            <div className="station-neighbours card">
              {previousStation ? (
                <button type="button" onClick={() => openRelatedStation(previousStation.id)}>
                  <Icon name="arrow" size={18} />
                  <span><small>{t('previous')}</small><strong>{stationName(previousStation)}</strong></span>
                </button>
              ) : <div className="station-neighbour-empty">{t('lineStart')}</div>}
              <span className="station-current-node" style={{ background: line.color }}><i /></span>
              {nextStation ? (
                <button type="button" onClick={() => openRelatedStation(nextStation.id)}>
                  <span><small>{t('next')}</small><strong>{stationName(nextStation)}</strong></span>
                  <Icon name="arrow" size={18} />
                </button>
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
                      <span><strong>{stationName(target)}</strong><small>{lineName(target.line)}</small></span>
                      <Icon name="chevron" size={19} />
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          <section className="station-section">
            <div className="station-section-heading"><div><span className="eyebrow">{t('location')}</span><h2>{t('stationOnMap')}</h2></div></div>
            <a className="station-map-card card" href={mapUrl} target="_blank" rel="noreferrer">
              <span className="station-map-icon"><Icon name="map" /></span>
              <span><strong>{t('openCoordinates')}</strong><small>{station.lat.toFixed(5)}, {station.lng.toFixed(5)}</small></span>
              <Icon name="chevron" />
            </a>
          </section>

          <section className="station-source-card card">
            <Icon name="info" size={20} />
            <div><strong>{t('stationData')}</strong><p>{t('stationDataText')}</p></div>
          </section>
        </main>
      </div>
    </section>
  )
}
