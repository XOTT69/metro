import { useEffect } from 'react'
import type { CSSProperties } from 'react'
import { lines, stationById } from '../data/metro'
import { getDirectionName } from '../lib/metro'
import type { RoutePlan } from '../types'
import { Icon } from './Icon'
import './TripMode.css'

interface Props {
  route: RoutePlan
  currentStationIndex: number
  onProgress: (index: number) => void
  onFinish: () => void
  onCancel: () => void
}

const findStep = (route: RoutePlan, currentId: string, nextId?: string) => {
  if (!nextId) return undefined
  return route.steps.find((step) =>
    step.stationIds.some((stationId, index) => stationId === currentId && step.stationIds[index + 1] === nextId),
  )
}

export const TripMode = ({ route, currentStationIndex, onProgress, onFinish, onCancel }: Props) => {
  const lastIndex = route.stationIds.length - 1
  const safeIndex = Math.min(Math.max(0, currentStationIndex), lastIndex)
  const currentId = route.stationIds[safeIndex]
  const nextId = route.stationIds[safeIndex + 1]
  const currentStation = stationById.get(currentId)!
  const nextStation = nextId ? stationById.get(nextId) : undefined
  const currentStep = findStep(route, currentId, nextId)
  const isFinished = safeIndex >= lastIndex
  const progress = lastIndex > 0 ? Math.round((safeIndex / lastIndex) * 100) : 100
  const remainingSegments = Math.max(0, lastIndex - safeIndex)
  const remainingMinutes = Math.max(0, Math.ceil(route.totalMinutes * (remainingSegments / Math.max(1, lastIndex))))
  const activeLine = currentStep?.line ? lines[currentStep.line] : lines[nextStation?.line ?? currentStation.line]
  const upcomingStations = route.stationIds.slice(safeIndex + 1, safeIndex + 4)
    .map((stationId) => stationById.get(stationId))
    .filter(Boolean)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKey)
    }
  }, [onCancel])

  const instruction = (() => {
    if (isFinished) return `Ви прибули на станцію «${route.to.name}»`
    if (!nextStation || !currentStep) return 'Продовжуйте за маршрутом'
    if (currentStep.type === 'transfer') return `Перейдіть до станції «${nextStation.name}»`
    const direction = getDirectionName(currentStep.line!, currentStep.from, currentStep.to)
    return `Їдьте в напрямку «${direction}» до «${nextStation.name}»`
  })()

  return (
    <div className="trip-mode" role="dialog" aria-modal="true" aria-label="Активна поїздка">
      <div className="trip-mode-shell" style={{ '--trip-color': activeLine.color } as CSSProperties}>
        <header className="trip-mode-header">
          <div>
            <span className="trip-kicker">Активна поїздка</span>
            <strong>{route.from.name} → {route.to.name}</strong>
          </div>
          <button type="button" className="trip-close" onClick={onCancel} aria-label="Завершити поїздку">
            <Icon name="close" />
          </button>
        </header>

        <div className="trip-progress-copy">
          <span>{progress}% маршруту</span>
          <span>{isFinished ? 'Прибули' : `≈ ${remainingMinutes} хв залишилось`}</span>
        </div>
        <div className="trip-progress" aria-label={`Пройдено ${progress}%`}>
          <span style={{ width: `${progress}%` }} />
        </div>

        <main className="trip-mode-content">
          <section className={`trip-current-card ${isFinished ? 'is-finished' : ''}`}>
            <span className="trip-line-pill" style={{ background: activeLine.color }}>{activeLine.id}</span>
            <div>
              <small>{isFinished ? 'Кінцева станція' : 'Ви зараз тут'}</small>
              <h1>{currentStation.name}</h1>
              <p>{instruction}</p>
            </div>
            <span className="trip-current-icon">
              <Icon name={isFinished ? 'check' : currentStep?.type === 'transfer' ? 'refresh' : 'train'} size={29} />
            </span>
          </section>

          {!isFinished && upcomingStations.length > 0 && (
            <section className="trip-upcoming">
              <div className="trip-section-title">
                <span>Далі за маршрутом</span>
                <small>Етап {safeIndex + 1} із {lastIndex}</small>
              </div>
              <div className="trip-upcoming-list">
                {upcomingStations.map((station, index) => (
                  <div className={index === 0 ? 'is-next' : ''} key={station!.id}>
                    <span className="trip-stop-dot" />
                    <span><strong>{station!.name}</strong><small>{lines[station!.line].name}</small></span>
                    {index === 0 && <em>наступна</em>}
                  </div>
                ))}
              </div>
            </section>
          )}

          <p className="trip-note"><Icon name="info" size={16} /> Перемикайте станції вручну. Застосунок не відстежує рух поїзда в реальному часі.</p>
        </main>

        <footer className="trip-mode-actions">
          {!isFinished && (
            <button
              type="button"
              className="trip-secondary"
              disabled={safeIndex === 0}
              onClick={() => onProgress(safeIndex - 1)}
            >
              Назад
            </button>
          )}
          <button
            type="button"
            className="trip-primary"
            onClick={() => isFinished ? onFinish() : onProgress(safeIndex + 1)}
          >
            {isFinished ? 'Завершити' : 'Наступна станція'}
            <Icon name={isFinished ? 'check' : 'arrow'} size={19} />
          </button>
        </footer>
      </div>
    </div>
  )
}
