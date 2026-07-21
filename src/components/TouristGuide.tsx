import { useMemo, useState } from 'react'
import { touristPlaces, type TouristCategory } from '../data/places'
import { lines, stationById } from '../data/metro'
import { useLanguage } from '../lib/i18n'
import { Icon } from './Icon'

interface Props {
  onBuildRoute: (stationId: string) => void
  onOpenStation: (stationId: string) => void
}

type CategoryFilter = 'all' | TouristCategory

const categories: Array<{ id: CategoryFilter; key: 'touristAll' | 'touristHistory' | 'touristParks' | 'touristCulture' | 'touristViews' }> = [
  { id: 'all', key: 'touristAll' },
  { id: 'history', key: 'touristHistory' },
  { id: 'parks', key: 'touristParks' },
  { id: 'culture', key: 'touristCulture' },
  { id: 'views', key: 'touristViews' },
]

export const TouristGuide = ({ onBuildRoute, onOpenStation }: Props) => {
  const { language, t, stationName, lineName, minuteLabel } = useLanguage()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const normalized = query.trim().toLocaleLowerCase(language === 'uk' ? 'uk-UA' : 'en-GB')

  const places = useMemo(() => touristPlaces.filter((place) => {
    if (category !== 'all' && place.category !== category) return false
    if (!normalized) return true
    return [place.name, place.nameEn, place.description, place.descriptionEn]
      .some((value) => value.toLocaleLowerCase().includes(normalized))
  }), [category, normalized])

  return (
    <section className="tourist-page page-section">
      <header className="tourist-hero">
        <div className="tourist-hero-copy">
          <span className="eyebrow">{t('touristEyebrow')}</span>
          <h1>{t('touristTitle')}</h1>
          <p>{t('touristIntro')}</p>
        </div>
        <div className="tourist-hero-art" aria-hidden="true">
          <span>К</span><i /><b>Y</b>
        </div>
      </header>

      <section className="tourist-controls card">
        <label className="tourist-search">
          <Icon name="search" size={20} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('touristSearch')}
            autoComplete="off"
          />
          {query && <button type="button" onClick={() => setQuery('')} aria-label={t('clearSearch')}><Icon name="close" size={17} /></button>}
        </label>
        <div className="tourist-categories" aria-label={t('touristAll')}>
          {categories.map((item) => (
            <button
              type="button"
              className={category === item.id ? 'active' : ''}
              key={item.id}
              onClick={() => setCategory(item.id)}
            >
              {t(item.key)}
            </button>
          ))}
        </div>
      </section>

      {places.length > 0 ? (
        <div className="tourist-grid">
          {places.map((place) => {
            const station = stationById.get(place.stationId)!
            const line = lines[station.line]
            const mapUrl = `https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lng}#map=17/${place.lat}/${place.lng}`
            return (
              <article className={`tourist-card card category-${place.category}`} key={place.id}>
                <div className="tourist-card-visual">
                  <span>{place.symbol}</span>
                  <i style={{ background: line.color }} />
                </div>
                <div className="tourist-card-body">
                  <div className="tourist-card-heading">
                    <div>
                      <span className="tourist-category-label">{t(categories.find((item) => item.id === place.category)!.key)}</span>
                      <h2>{language === 'uk' ? place.name : place.nameEn}</h2>
                    </div>
                    <a href={mapUrl} target="_blank" rel="noreferrer" aria-label={t('openPlaceMap')} title={t('openPlaceMap')}>
                      <Icon name="map" size={18} />
                    </a>
                  </div>
                  <p>{language === 'uk' ? place.description : place.descriptionEn}</p>
                  <button type="button" className="tourist-station" onClick={() => onOpenStation(station.id)}>
                    <span className="line-pill" style={{ background: line.color }}>{station.line}</span>
                    <span>
                      <small>{t('touristNear')}</small>
                      <strong>{stationName(station)}</strong>
                      <em>{lineName(station.line)}</em>
                    </span>
                    <b><Icon name="location" size={14} /> {place.walkMinutes === 0 ? '0' : `≈ ${place.walkMinutes}`} {minuteLabel} {t('touristWalk')}</b>
                  </button>
                  <div className="tourist-card-actions">
                    <button type="button" className="primary-button" onClick={() => onBuildRoute(station.id)}>
                      <Icon name="route" size={18} /> {t('buildRoute')}
                    </button>
                    <button type="button" className="secondary-button" onClick={() => onOpenStation(station.id)}>
                      {t('stationDetails')}
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="tourist-empty card"><Icon name="search" size={34} /><h2>{t('touristNoResults')}</h2></div>
      )}

      <section className="tourist-note card">
        <Icon name="info" size={21} />
        <div><strong>{t('touristNoteTitle')}</strong><p>{t('touristNote')}</p></div>
      </section>
    </section>
  )
}
