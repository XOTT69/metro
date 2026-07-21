import { lines, stationById } from '../data/metro'
import { getDirectionName } from '../lib/metro'
import type { RoutePlan } from '../types'
import { Icon } from './Icon'

interface Props {
  route: RoutePlan
  onStationClick: (stationId: string) => void
  onShare: () => void
}

export const RouteResult = ({ route, onStationClick, onShare }: Props) => (
  <section className="route-result card">
    <header className="route-summary">
      <div>
        <span className="eyebrow">Найшвидший маршрут</span>
        <div className="route-time"><strong>{route.totalMinutes}</strong><span>хв</span></div>
      </div>
      <button className="secondary-button compact-button" type="button" onClick={onShare}>
        <Icon name="share" size={18} /> Поділитися
      </button>
    </header>

    <div className="route-stats" aria-label="Параметри маршруту">
      <span><Icon name="train" size={17} /> {route.stationCount} станцій</span>
      <span><Icon name="refresh" size={17} /> {route.transferCount ? `${route.transferCount} пересадка` : 'Без пересадок'}</span>
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
