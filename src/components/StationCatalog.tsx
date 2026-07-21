import { useEffect, useMemo, useRef, useState } from 'react'
import { lines, stations } from '../data/metro'
import type { LineId } from '../types'
import { Icon } from './Icon'

type LineFilter = 'all' | LineId

interface Props {
  favoriteIds: string[]
  onOpenStation: (stationId: string) => void
  onClose: () => void
}

const filterOptions: Array<{ id: LineFilter; label: string }> = [
  { id: 'all', label: 'Усі' },
  { id: 'M1', label: 'M1' },
  { id: 'M2', label: 'M2' },
  { id: 'M3', label: 'M3' },
]

export const StationCatalog = ({ favoriteIds, onOpenStation, onClose }: Props) => {
  const [query, setQuery] = useState('')
  const [lineFilter, setLineFilter] = useState<LineFilter>('all')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === '/' && document.activeElement !== searchRef.current) {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const normalizedQuery = query.trim().toLocaleLowerCase('uk-UA')
  const filteredStations = useMemo(
    () => stations.filter((station) => {
      if (lineFilter !== 'all' && station.line !== lineFilter) return false
      if (!normalizedQuery) return true
      return [station.name, station.nameEn, station.code]
        .some((value) => value.toLocaleLowerCase('uk-UA').includes(normalizedQuery))
    }),
    [lineFilter, normalizedQuery],
  )

  return (
    <section className="station-catalog-screen" role="dialog" aria-modal="true" aria-label="Каталог станцій метро">
      <header className="catalog-topbar">
        <button type="button" className="catalog-back-button" onClick={onClose} aria-label="Закрити каталог">
          <Icon name="arrow" size={21} />
        </button>
        <div>
          <span className="eyebrow">Київський метрополітен</span>
          <h1>Усі станції</h1>
        </div>
        <span className="catalog-count">{filteredStations.length}</span>
      </header>

      <div className="catalog-controls">
        <label className="catalog-search">
          <Icon name="search" size={21} />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Назва українською або англійською"
            autoComplete="off"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Очистити пошук">
              <Icon name="close" size={17} />
            </button>
          )}
        </label>

        <div className="catalog-line-filters" aria-label="Фільтр за лінією">
          {filterOptions.map((option) => {
            const line = option.id === 'all' ? null : lines[option.id]
            return (
              <button
                type="button"
                key={option.id}
                className={lineFilter === option.id ? 'active' : ''}
                onClick={() => setLineFilter(option.id)}
              >
                {line && <i style={{ background: line.color }} />}
                {option.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="catalog-content">
        {(Object.keys(lines) as LineId[]).map((lineId) => {
          const line = lines[lineId]
          const lineStations = filteredStations
            .filter((station) => station.line === lineId)
            .sort((a, b) => a.order - b.order)
          if (lineStations.length === 0) return null

          return (
            <section className="catalog-line-section" key={lineId}>
              <header>
                <span className="catalog-line-code" style={{ background: line.color }}>{lineId}</span>
                <span><strong>{line.name}</strong><small>{line.terminalStart} — {line.terminalEnd}</small></span>
                <b>{lineStations.length}</b>
              </header>

              <div className="catalog-station-list">
                {lineStations.map((station) => (
                  <button
                    type="button"
                    className="catalog-station-row"
                    key={station.id}
                    onClick={() => onOpenStation(station.id)}
                  >
                    <span className="catalog-station-order" style={{ borderColor: line.color }}>{station.order + 1}</span>
                    <span className="catalog-station-copy">
                      <strong>{station.name}</strong>
                      <small>{station.nameEn} · {station.code}</small>
                    </span>
                    <span className="catalog-station-badges">
                      {station.transferTo?.length ? <em><Icon name="refresh" size={14} /> Пересадка</em> : null}
                      {favoriteIds.includes(station.id) ? <Icon name="star" size={17} className="filled" /> : null}
                    </span>
                    <Icon name="chevron" size={18} />
                  </button>
                ))}
              </div>
            </section>
          )
        })}

        {filteredStations.length === 0 && (
          <div className="catalog-empty card">
            <Icon name="search" size={34} />
            <h2>Станцію не знайдено</h2>
            <p>Перевірте написання або виберіть іншу лінію.</p>
            <button type="button" className="secondary-button" onClick={() => { setQuery(''); setLineFilter('all') }}>
              Скинути фільтри
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
