import type { CSSProperties } from "react";
import {
  LINE_META,
  LINE_STATIONS,
  STATION_BY_ID,
  type LineId,
  type Station,
} from "../metro-data";

export function RouteItinerary({
  route,
  onStation,
}: {
  route: string[];
  onStation: (id: string) => void;
}) {
  if (!route.length) return null;
  return (
    <ol className="route-itinerary" aria-label="Послідовність станцій маршруту">
      {route.map((id, index) => {
        const station = STATION_BY_ID[id];
        const previous = index > 0 ? STATION_BY_ID[route[index - 1]] : null;
        const isTransfer = previous && previous.line !== station.line;
        return (
          <li key={id} className={isTransfer ? "is-transfer" : ""}>
            <span
              className="itinerary-dot"
              style={{ background: LINE_META[station.line].color }}
            />
            <button type="button" onClick={() => onStation(id)}>
              <strong>{station.name}</strong>
              <small>
                {isTransfer
                  ? `Пересадка на ${LINE_META[station.line].code}`
                  : index === 0
                    ? "Початок"
                    : index === route.length - 1
                      ? "Прибуття"
                      : LINE_META[station.line].code}
              </small>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function RouteJourney({
  route,
  onStation,
}: {
  route: string[];
  onStation: (id: string) => void;
}) {
  const legs = route.reduce<{ line: LineId; stations: Station[] }[]>(
    (result, id) => {
      const station = STATION_BY_ID[id];
      const current = result.at(-1);
      if (!current || current.line !== station.line) {
        result.push({ line: station.line, stations: [station] });
      } else {
        current.stations.push(station);
      }
      return result;
    },
    [],
  );

  return (
    <div className="journey-card">
      <div className="journey-card__summary">
        <span>{route.length} станцій у правильному порядку</span>
        <strong>
          {legs.length === 1
            ? "Без пересадок"
            : `${legs.length - 1} пересадка`}
        </strong>
      </div>
      <div className="journey-legs">
        {legs.map((leg, legIndex) => {
          const first = leg.stations[0];
          const last = leg.stations.at(-1)!;
          const firstIndex = LINE_STATIONS[leg.line].findIndex(
            ({ id }) => id === first.id,
          );
          const lastIndex = LINE_STATIONS[leg.line].findIndex(
            ({ id }) => id === last.id,
          );
          const terminal =
            LINE_STATIONS[leg.line][
              lastIndex >= firstIndex ? LINE_STATIONS[leg.line].length - 1 : 0
            ];
          const directionLabel =
            leg.stations.length === 1
              ? "пересадка та вихід"
              : `у напрямку ${terminal.name}`;
          return (
            <section
              className="journey-leg"
              key={`${leg.line}-${legIndex}`}
              style={
                { "--line-color": LINE_META[leg.line].color } as CSSProperties
              }
            >
              <header>
                <span
                  className="line-chip"
                  style={{ background: LINE_META[leg.line].color }}
                >
                  {LINE_META[leg.line].code}
                </span>
                <div>
                  <small>{LINE_META[leg.line].name} лінія</small>
                  <strong>{directionLabel}</strong>
                </div>
                <b>{Math.max(0, leg.stations.length - 1)} зуп.</b>
              </header>
              <ol>
                {leg.stations.map((station, stationIndex) => (
                  <li key={station.id}>
                    <button
                      type="button"
                      onClick={() => onStation(station.id)}
                    >
                      <i aria-hidden="true" />
                      <span>
                        <strong>{station.name}</strong>
                        <small>
                          {legIndex === 0 && stationIndex === 0
                            ? "Старт"
                            : legIndex === legs.length - 1 &&
                                stationIndex === leg.stations.length - 1
                              ? "Фініш"
                              : "Відкрити таймер"}
                        </small>
                      </span>
                      <span aria-hidden="true">›</span>
                    </button>
                  </li>
                ))}
              </ol>
              {legIndex < legs.length - 1 && (
                <div className="journey-transfer">
                  <span aria-hidden="true">⇄</span>
                  Перейдіть на {LINE_META[legs[legIndex + 1].line].code}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
