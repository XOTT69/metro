import { useMemo, useState } from 'react'
import { lines, stations } from '../data/metro'
import type { Station } from '../types'
import { Icon } from './Icon'

interface Props {
  title: string
  selectedId?: string
  favoriteIds: string[]
  onSelect: (station: Station) => void
  onClose: () => void
}

export const StationPicker = ({ title, selectedId, favoriteIds, onSelect, onClose }: Props) => {
  const [query, setQuery] = useState('')
  const normalized = query.toLowerCase().trim()
  const filtered = useMemo(
    () =>
      stations.filter(
        (station) =>
          station.name.toLowerCase().includes(normalized) ||
          station.nameEn.toLowerCase().includes(normalized),
      ),
    [normalized],
  )

  const favorites = filtered.filter((station) => favoriteIds.includes(station.id))
  const regular = filtered.filter((station) => !favoriteIds.includes(station.id))

  const renderStation = (station: Station) => (
    <button
      className={`station-option ${selectedId === station.id ? 'is-selected' : ''}`}
      key={station.id}
      type="button"
      onClick={() => onSelect(station)}
    >
      <span className="line-dot" style={{ background: lines[station.line].color }} />
      <span className="station-option-copy">
        <strong>{station.name}</strong>
        <small>{lines[station.line].name}</small>
      </span>
      {favoriteIds.includes(station.id) && <Icon name="star" size={17} className="favorite-icon filled" />}
      {selectedId === station.id && <Icon name="check" size={19} />}
    </button>
  )

  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="station-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <header className="sheet-header">
          <div>
            <span className="eyebrow">Київський метрополітен</span>
            <h2>{title}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Закрити">
            <Icon name="close" />
          </button>
        </header>
        <label className="search-field">
          <Icon name="search" size={20} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Назва станції"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Очистити пошук">
              <Icon name="close" size={17} />
            </button>
          )}
        </label>
        <div className="station-options">
          {favorites.length > 0 && (
            <div className="option-group">
              <div className="option-group-title"><Icon name="star" size={15} /> Обране</div>
              {favorites.map(renderStation)}
            </div>
          )}
          <div className="option-group">
            {favorites.length > 0 && <div className="option-group-title">Усі станції</div>}
            {regular.map(renderStation)}
          </div>
          {filtered.length === 0 && <div className="empty-state compact">Станцію не знайдено</div>}
        </div>
      </section>
    </div>
  )
}
