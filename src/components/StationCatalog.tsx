import { useEffect, useMemo, useRef, useState } from 'react'
import { lines, stations } from '../data/metro'
import { useLanguage } from '../lib/i18n'
import type { LineId } from '../types'
import { Icon } from './Icon'

type LineFilter = 'all' | LineId

interface Props {
  favoriteIds: string[]
  onOpenStation: (stationId: string) => void
  onClose: () => void
}

const filterIds: LineFilter[] = ['all', 'M1', 'M2', 'M3']

export const StationCatalog = ({ favoriteIds, onOpenStation, onClose }: Props) => {
  const { language, t, stationName, lineName, terminalName } = useLanguage()
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

  const normalizedQuery = query.trim().toLocaleLowerCase(language === 'uk' ? 'uk-UA' : 'en-GB')
  const filteredStations = useMemo(
    () => stations.filter((station) => {
      if (lineFilter !== 'all' && station.line !== lineFilter) return false
      if (!normalizedQuery) return true
      return [station.name, station.nameEn, station.code].some((value) => value.toLocaleLowerCase().includes(normalizedQuery))
    }),
    [lineFilter, normalizedQuery],
  )

  return (
    <section className="station-catalog-screen" role="dialog" aria-modal="true" aria-label={t('allStations')}>
      <header className="catalog-topbar">
        <button type="button" className="catalog-back-button" onClick={onClose} aria-label={t('closeCatalog')}>
          <Icon name="arrow" size={21} />
        </button>
        <div>
          <span className="eyebrow">{t('kyivMetro')}</span>
          <h1>{t('allStations')}</h1>
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
            placeholder={t('stationSearchPlaceholder')}
            autoComplete="off"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label={t('clearSearch')}>
              <Icon name="close" size={17} />
            </button>
          )}
        </label>

        <div className="catalog-line-filters" aria-label={t('lineFilter')}>
          {filterIds.map((id) => {
            const line = id === 'all' ? null : lines[id]
            return (
              <button type="button" key={id} className={lineFilter === id ? 'active' : ''} onClick={() => setLineFilter(id)}>
                {line && <i style={{ background: line.color }} />}
                {id === 'all' ? t('all') : id}
              </button>
            )
          })}
        </div>
      </div>

      <div className="catalog-content">
        {(Object.keys(lines) as LineId[]).map((lineId) => {
          const line = lines[lineId]
          const lineStations = filteredStations.filter((station) => station.line === lineId).sort((a, b) => a.order - b.order)
          if (lineStations.length === 0) return null

          return (
            <section className="catalog-line-section" key={lineId}>
              <header>
                <span className="catalog-line-code" style={{ background: line.color }}>{lineId}</span>
                <span><strong>{lineName(lineId)}</strong><small>{terminalName(lineId, 'start')} — {terminalName(lineId, 'end')}</small></span>
                <b>{lineStations.length}</b>
              </header>

              <div className="catalog-station-list">
                {lineStations.map((station) => (
                  <button type="button" className="catalog-station-row" key={station.id} onClick={() => onOpenStation(station.id)}>
                    <span className="catalog-station-order" style={{ borderColor: line.color }}>{station.order + 1}</span>
                    <span className="catalog-station-copy">
                      <strong>{stationName(station)}</strong>
                      <small>{language === 'uk' ? station.nameEn : station.name} · {station.code}</small>
                    </span>
                    <span className="catalog-station-badges">
                      {station.transferTo?.length ? <em><Icon name="refresh" size={14} /> {t('transfer')}</em> : null}
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
            <h2>{t('stationNotFound')}</h2>
            <p>{t('stationNotFoundIntro')}</p>
            <button type="button" className="secondary-button" onClick={() => { setQuery(''); setLineFilter('all') }}>
              {t('resetFilters')}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
