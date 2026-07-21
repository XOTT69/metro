import { useEffect, useState } from 'react'
import { lines, stationById } from '../data/metro'
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
}

export const StationDetails = ({ station, isFavorite, onToggleFavorite, onClose, onSetAsFrom, onSetAsTo }: Props) => {
  const [, setTick] = useState(0)
  const line = lines[station.line]
  const index = line.stationIds.indexOf(station.id)
  const hasStartDirection = index > 0
  const hasEndDirection = index < line.stationIds.length - 1

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="station-detail-sheet" role="dialog" aria-modal="true" aria-label={`Станція ${station.name}`}>
        <div className="detail-accent" style={{ background: line.color }} />
        <header className="sheet-header detail-header">
          <div className="station-title-row">
            <span className="line-pill" style={{ background: line.color }}>{station.line}</span>
            <div>
              <span className="eyebrow">Станція метро</span>
              <h2>{station.name}</h2>
              <small>{station.nameEn}</small>
            </div>
          </div>
          <div className="detail-actions">
            <button type="button" className={`icon-button ${isFavorite ? 'is-favorite' : ''}`} onClick={onToggleFavorite} aria-label="Додати в обране">
              <Icon name="star" />
            </button>
            <button type="button" className="icon-button" onClick={onClose} aria-label="Закрити"><Icon name="close" /></button>
          </div>
        </header>

        <div className="detail-body">
          <div className="train-grid">
            {hasStartDirection && (
              <div className="train-card">
                <span>До «{line.terminalStart}»</span>
                <strong>{formatCountdown(getNextTrainSeconds(station, false))}</strong>
                <small>розрахунковий час</small>
              </div>
            )}
            {hasEndDirection && (
              <div className="train-card">
                <span>До «{line.terminalEnd}»</span>
                <strong>{formatCountdown(getNextTrainSeconds(station, true))}</strong>
                <small>розрахунковий час</small>
              </div>
            )}
          </div>

          <div className="detail-facts">
            <span><Icon name="clock" size={19} /><span><small>Поточний інтервал</small><strong>{getHeadwayMinutes(station.line) || '—'} хв</strong></span></span>
            <span><Icon name="train" size={19} /><span><small>Лінія</small><strong>{line.name}</strong></span></span>
            {station.transferTo?.map((transferId) => {
              const target = stationById.get(transferId)
              return target ? <span key={transferId}><Icon name="refresh" size={19} /><span><small>Пересадка</small><strong>{target.name}</strong></span></span> : null
            })}
          </div>

          <div className="detail-buttons">
            <button type="button" className="primary-button" onClick={onSetAsFrom}><Icon name="location" size={19} /> Звідси</button>
            <button type="button" className="secondary-button" onClick={onSetAsTo}><Icon name="arrow" size={19} /> Сюди</button>
          </div>

          <p className="data-note"><Icon name="info" size={16} /> Таймер не є live-трекінгом поїздів і розраховується за типовим інтервалом руху.</p>
        </div>
      </section>
    </div>
  )
}
