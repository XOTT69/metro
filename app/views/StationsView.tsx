import { useMemo, useState } from "react";
import type { SavedMetroRoute } from "../app-types";
import {
  LINE_META,
  STATION_BY_ID,
  STATIONS,
  estimateTripMinutes,
  getRoute,
  getStationPredictions,
  routeTransfers,
  type LineId,
} from "../metro-data";
import { useNow } from "../hooks/useNow";
import { normalizeStationName } from "../station-search";
import { formatTimer } from "../components/station-time";

type LineFilter = "all" | LineId | "favorites";
const ukCollator = new Intl.Collator("uk");
const SORTED_STATIONS = [...STATIONS].sort((a, b) =>
  ukCollator.compare(a.name, b.name),
);

export type StationsViewProps = {
  favorites: string[];
  savedRoutes: SavedMetroRoute[];
  recentRoutes: SavedMetroRoute[];
  onStation: (id: string) => void;
  onFavorite: (id: string) => void;
  onJourney: (from: string, to: string) => void;
  onRemoveSaved: (from: string, to: string) => void;
};

function MetroRouteCard({
  journey,
  saved,
  onOpen,
  onRemove,
}: {
  journey: SavedMetroRoute;
  saved?: boolean;
  onOpen: () => void;
  onRemove?: () => void;
}) {
  const route = getRoute(journey.from, journey.to);
  const tripMinutes = estimateTripMinutes(route);
  const transfers = routeTransfers(route);

  return (
    <article className="my-route-card">
      <button type="button" className="my-route-card__main" onClick={onOpen}>
        <span className="my-route-card__lines" aria-hidden="true">
          {[...new Set(route.map((id) => STATION_BY_ID[id].line))].map((line) => (
            <i key={line} style={{ background: LINE_META[line].color }} />
          ))}
        </span>
        <span>
          <small>{saved ? "Збережений маршрут" : "Недавня поїздка"}</small>
          <strong>
            {STATION_BY_ID[journey.from].name} → {STATION_BY_ID[journey.to].name}
          </strong>
          <span>
            ≈ {tripMinutes} хв · {Math.max(0, route.length - 1)} перегонів ·{" "}
            {transfers} пересад.
          </span>
        </span>
        <b aria-hidden="true">→</b>
      </button>
      {onRemove && (
        <button
          type="button"
          className="my-route-card__remove"
          onClick={onRemove}
          aria-label={`Видалити маршрут ${STATION_BY_ID[journey.from].name} — ${STATION_BY_ID[journey.to].name}`}
        >
          ×
        </button>
      )}
    </article>
  );
}

export default function StationsView({
  favorites,
  savedRoutes,
  recentRoutes,
  onStation,
  onFavorite,
  onJourney,
  onRemoveSaved,
}: StationsViewProps) {
  const [stationSearch, setStationSearch] = useState("");
  const [lineFilter, setLineFilter] = useState<LineFilter>("all");
  const now = useNow();
  const filteredStations = useMemo(() => {
    const query = normalizeStationName(stationSearch);
    return SORTED_STATIONS.filter((station) => {
      const matchesQuery =
        !query || normalizeStationName(station.name).includes(query);
      const matchesLine =
        lineFilter === "all" ||
        (lineFilter === "favorites"
          ? favorites.includes(station.id)
          : station.line === lineFilter);
      return matchesQuery && matchesLine;
    });
  }, [favorites, lineFilter, stationSearch]);

  return (
    <section className="stations-view my-view">
      <div className="section-heading my-view__heading">
        <div>
          <span className="eyebrow-label">Ваш транспортний простір</span>
          <h1>Моє</h1>
          <p>
            Збережені маршрути, недавні поїздки й улюблені станції — усе, до
            чого хочеться повернутися одним дотиком.
          </p>
        </div>
      </div>

      <section className="my-section" aria-labelledby="saved-routes-title">
        <div className="my-section__heading">
          <div>
            <span className="eyebrow-label">Швидкий старт</span>
            <h2 id="saved-routes-title">Збережені маршрути</h2>
          </div>
          <span>{savedRoutes.length}</span>
        </div>
        {savedRoutes.length ? (
          <div className="my-route-grid">
            {savedRoutes.map((journey) => (
              <MetroRouteCard
                key={`${journey.from}-${journey.to}`}
                journey={journey}
                saved
                onOpen={() => onJourney(journey.from, journey.to)}
                onRemove={() => onRemoveSaved(journey.from, journey.to)}
              />
            ))}
          </div>
        ) : (
          <div className="my-empty-card">
            <strong>Тут зʼявляться ваші звичні поїздки</strong>
            <span>
              Побудуйте маршрут і натисніть «Зберегти» — він буде доступний
              офлайн.
            </span>
          </div>
        )}
      </section>

      {recentRoutes.length > 0 && (
        <section className="my-section" aria-labelledby="recent-routes-title">
          <div className="my-section__heading">
            <div>
              <span className="eyebrow-label">Продовжити</span>
              <h2 id="recent-routes-title">Недавні поїздки</h2>
            </div>
          </div>
          <div className="my-route-grid my-route-grid--recent">
            {recentRoutes.slice(0, 4).map((journey) => (
              <MetroRouteCard
                key={`${journey.from}-${journey.to}`}
                journey={journey}
                onOpen={() => onJourney(journey.from, journey.to)}
              />
            ))}
          </div>
        </section>
      )}

      <section className="my-section" aria-labelledby="favorite-stations-title">
        <div className="my-section__heading">
          <div>
            <span className="eyebrow-label">Таймер у два дотики</span>
            <h2 id="favorite-stations-title">Улюблені станції</h2>
          </div>
          <span>{favorites.length}</span>
        </div>
        {favorites.length ? (
          <div className="my-favorite-grid">
            {favorites.map((id) => {
              const station = STATION_BY_ID[id];
              const next = Math.min(
                ...getStationPredictions(station, now).map(({ seconds }) => seconds),
              );
              return (
                <button key={id} type="button" onClick={() => onStation(id)}>
                  <span
                    className="line-badge"
                    style={{ background: LINE_META[station.line].color }}
                  >
                    {LINE_META[station.line].code}
                  </span>
                  <span>
                    <strong>{station.name}</strong>
                    <small>найближчий розрахунково</small>
                  </span>
                  <b>{formatTimer(next)}</b>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="my-empty-card my-empty-card--compact">
            <strong>Ще немає улюблених станцій</strong>
            <span>Додайте їх з довідника нижче або зі сторінки станції.</span>
          </div>
        )}
      </section>

      <section className="my-directory" aria-labelledby="station-directory-title">
        <div className="my-section__heading">
          <div>
            <span className="eyebrow-label">52 чинні станції</span>
            <h2 id="station-directory-title">Довідник станцій</h2>
          </div>
        </div>
        <div className="station-tools">
          <label className="station-search">
            <span>Пошук станції</span>
            <input
              type="search"
              value={stationSearch}
              onChange={(event) => setStationSearch(event.target.value)}
              placeholder="Наприклад, Золоті ворота"
            />
          </label>
          <div className="line-filters" role="group" aria-label="Фільтр станцій">
            {(
              [
                ["all", "Усі"],
                ["red", "M1"],
                ["blue", "M2"],
                ["green", "M3"],
                ["favorites", "★ Обрані"],
              ] as [LineFilter, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={lineFilter === id ? "is-active" : ""}
                onClick={() => setLineFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <p className="results-count">
          Знайдено: <strong>{filteredStations.length}</strong>
        </p>
        <div className="station-grid">
          {filteredStations.map((station) => {
            const predictions = getStationPredictions(station, now);
            const next = Math.min(...predictions.map(({ seconds }) => seconds));
            return (
              <article key={station.id} className="station-card">
                <button
                  type="button"
                  className="station-card__main"
                  onClick={() => onStation(station.id)}
                >
                  <span
                    className="line-badge"
                    style={{ background: LINE_META[station.line].color }}
                  >
                    {LINE_META[station.line].code}
                  </span>
                  <span>
                    <strong>{station.name}</strong>
                    <small>{LINE_META[station.line].name}</small>
                  </span>
                </button>
                <button
                  type="button"
                  className="station-card__timer"
                  onClick={() => onStation(station.id)}
                  aria-label={`Відкрити таймер станції ${station.name}`}
                >
                  <small>розрахунково</small>
                  <strong>{formatTimer(next)}</strong>
                </button>
                <button
                  type="button"
                  className="favorite-button"
                  onClick={() => onFavorite(station.id)}
                  aria-label={
                    favorites.includes(station.id)
                      ? `Прибрати ${station.name} з обраного`
                      : `Додати ${station.name} в обране`
                  }
                >
                  {favorites.includes(station.id) ? "★" : "☆"}
                </button>
              </article>
            );
          })}
        </div>
        {!filteredStations.length && (
          <div className="empty-state">
            Немає станцій за цим запитом. Спробуйте іншу назву або фільтр.
          </div>
        )}
      </section>
    </section>
  );
}
