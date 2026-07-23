import { useMemo, useState } from "react";
import {
  LINE_META,
  STATION_BY_ID,
  STATIONS,
  getStationPredictions,
  type LineId,
} from "../metro-data";
import { useNow } from "../hooks/useNow";
import { normalizeStationName } from "../station-search";
import TrackedStation from "../components/TrackedStation";
import { formatTimer } from "../components/station-time";

type LineFilter = "all" | LineId | "favorites";
const ukCollator = new Intl.Collator("uk");
const SORTED_STATIONS = [...STATIONS].sort((a, b) =>
  ukCollator.compare(a.name, b.name),
);

export type StationsViewProps = {
  favorites: string[];
  timerStation: string;
  onStation: (id: string) => void;
  onTrack: (id: string) => void;
  onFavorite: (id: string) => void;
};

export default function StationsView({
  favorites,
  timerStation,
  onStation,
  onTrack,
  onFavorite,
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
    <section className="stations-view">
      <div className="section-heading">
        <div>
          <span className="eyebrow-label">Довідник і розрахункові таймери</span>
          <h1>Коли наступний?</h1>
          <p>
            Відстежуйте одну станцію постійно або відкрийте таймер будь-якої
            з 52 станцій.
          </p>
        </div>
      </div>

      <TrackedStation
        station={STATION_BY_ID[timerStation] ?? STATIONS[0]}
        now={now}
        onOpen={() => onStation(timerStation)}
        onChange={onTrack}
      />

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
            <article
              key={station.id}
              className={`station-card ${
                timerStation === station.id ? "is-tracked" : ""
              }`}
            >
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
                onClick={() => onTrack(station.id)}
                aria-label={`Відстежувати таймер станції ${station.name}`}
              >
                <small>
                  {timerStation === station.id ? "відстежується" : "найближчий"}
                </small>
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
  );
}
