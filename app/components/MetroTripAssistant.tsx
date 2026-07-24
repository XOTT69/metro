import {
  LINE_META,
  LINE_STATIONS,
  STATION_BY_ID,
  getStationPredictions,
  type LineId,
  type TrainPrediction,
} from "../metro-data";
import { useNow } from "../hooks/useNow";
import { formatTimer } from "./station-time";

type MetroLeg = {
  line: LineId;
  stations: string[];
};

export type MetroTransferHint = {
  from: string;
  to: string;
  line: LineId;
  minutesFromStart: number;
};

export type MetroTripGuide = {
  boardingStation: string;
  direction: string;
  prediction: TrainPrediction | null;
  arrivalSeconds: number;
  preBoardMinutes: number;
  transfers: MetroTransferHint[];
};

function getLegs(route: string[]) {
  return route.reduce<MetroLeg[]>((legs, id) => {
    const station = STATION_BY_ID[id];
    const last = legs.at(-1);
    if (!station) return legs;
    if (last?.line === station.line) last.stations.push(id);
    else legs.push({ line: station.line, stations: [id] });
    return legs;
  }, []);
}

function getDirection(line: LineId, currentId: string, nextId: string) {
  const stations = LINE_STATIONS[line];
  const currentIndex = stations.findIndex(({ id }) => id === currentId);
  const nextIndex = stations.findIndex(({ id }) => id === nextId);
  return nextIndex > currentIndex
    ? stations.at(-1)!.name
    : stations[0].name;
}

export function getMetroTripGuide(
  route: string[],
  tripMinutes: number,
  now: Date,
): MetroTripGuide | null {
  if (!route.length) return null;

  const legs = getLegs(route);
  const rideLegIndex = legs.findIndex(({ stations }) => stations.length > 1);
  const rideLeg = legs[rideLegIndex];
  const transfers: MetroTransferHint[] = [];
  let elapsedMinutes = 0;

  for (let index = 1; index < route.length; index += 1) {
    const previous = STATION_BY_ID[route[index - 1]];
    const current = STATION_BY_ID[route[index]];
    if (previous.line === current.line) {
      elapsedMinutes += 2.35;
    } else {
      elapsedMinutes += 4.5;
      transfers.push({
        from: previous.id,
        to: current.id,
        line: current.line,
        minutesFromStart: elapsedMinutes,
      });
    }
  }

  if (!rideLeg) {
    return {
      boardingStation: route[0],
      direction: "",
      prediction: null,
      arrivalSeconds: Math.round(tripMinutes * 60),
      preBoardMinutes: 0,
      transfers,
    };
  }

  const boardingStation = rideLeg.stations[0];
  const direction = getDirection(
    rideLeg.line,
    boardingStation,
    rideLeg.stations[1],
  );
  const station = STATION_BY_ID[boardingStation];
  const predictions = getStationPredictions(station, now);
  const rawPrediction =
    predictions.find((prediction) => prediction.direction === direction) ??
    predictions[0];
  const preBoardMinutes = route
    .slice(1, route.indexOf(boardingStation) + 1)
    .reduce((minutes, id, index) => {
      const previous = STATION_BY_ID[route[index]];
      const current = STATION_BY_ID[id];
      return minutes + (previous.line === current.line ? 2.35 : 4.5);
    }, 0);
  const earliestBoarding = Math.round(preBoardMinutes * 60);
  const skippedTrains = Math.max(
    0,
    Math.ceil(
      (earliestBoarding - rawPrediction.seconds) /
        rawPrediction.intervalSeconds,
    ),
  );
  const predictionSeconds =
    rawPrediction.seconds + skippedTrains * rawPrediction.intervalSeconds;
  const prediction = skippedTrains
    ? {
        ...rawPrediction,
        seconds: predictionSeconds,
        followingSeconds: predictionSeconds + rawPrediction.intervalSeconds,
        clockTime: new Date(
          now.getTime() + predictionSeconds * 1000,
        ).toLocaleTimeString("uk-UA", {
          timeZone: "Europe/Kyiv",
          hour: "2-digit",
          minute: "2-digit",
        }),
      }
    : rawPrediction;
  const travelAfterBoarding = Math.max(0, tripMinutes - preBoardMinutes);

  return {
    boardingStation,
    direction,
    prediction,
    arrivalSeconds: Math.round(
      prediction.seconds + travelAfterBoarding * 60,
    ),
    preBoardMinutes,
    transfers,
  };
}

function clockAfter(now: Date, seconds: number) {
  return new Date(now.getTime() + seconds * 1000).toLocaleTimeString("uk-UA", {
    timeZone: "Europe/Kyiv",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MetroTripAssistant({
  route,
  tripMinutes,
  compact = false,
  now,
  onStation,
  onOpen,
}: {
  route: string[];
  tripMinutes: number;
  compact?: boolean;
  now?: Date;
  onStation?: (id: string) => void;
  onOpen?: () => void;
}) {
  const currentTime = useNow(now);
  const guide = getMetroTripGuide(route, tripMinutes, currentTime);
  const origin = STATION_BY_ID[route[0]];
  const destination = STATION_BY_ID[route.at(-1) ?? ""];

  if (!guide || !origin || !destination) return null;

  if (compact) {
    return (
      <button
        type="button"
        className="trip-assistant-compact"
        onClick={onOpen}
        aria-label={`Поїздка ${origin.name} — ${destination.name}`}
      >
        <span>{LINE_META[origin.line].code} · {origin.name}</span>
        <strong>
          {guide.prediction
            ? formatTimer(guide.prediction.seconds)
            : route.length === 1
              ? "ви тут"
              : "пішки"}
        </strong>
      </button>
    );
  }

  return (
    <section className="metro-trip-assistant" aria-live="polite">
      <div className="metro-trip-assistant__header">
        <div>
          <span className="eyebrow-label">Помічник вашої поїздки</span>
          <h2>Що робити зараз</h2>
        </div>
        <span className="calculated-chip">розрахунково</span>
      </div>

      {guide.prediction ? (
        <div className="metro-trip-assistant__next">
          <button
            type="button"
            className="metro-trip-assistant__station"
            onClick={() => onStation?.(guide.boardingStation)}
          >
            <span
              className="line-badge"
              style={{
                background:
                  LINE_META[STATION_BY_ID[guide.boardingStation].line].color,
              }}
            >
              {LINE_META[STATION_BY_ID[guide.boardingStation].line].code}
            </span>
            <span>
              <small>Сідайте на станції</small>
              <strong>{STATION_BY_ID[guide.boardingStation].name}</strong>
            </span>
          </button>
          <div className="metro-trip-assistant__countdown">
            <small>напрямок {guide.direction}</small>
            <strong>{formatTimer(guide.prediction.seconds)}</strong>
            <span>поїзд орієнтовно о {guide.prediction.clockTime}</span>
          </div>
        </div>
      ) : (
        <p className="metro-trip-assistant__walk">
          {route.length === 1
            ? "Ви вже на потрібній станції — їхати не потрібно."
            : "Потяг не потрібен: між цими станціями лише перехід."}
        </p>
      )}

      {guide.transfers.length > 0 && (
        <ol className="metro-trip-assistant__transfers">
          {guide.transfers.map((transfer) => (
            <li key={`${transfer.from}-${transfer.to}`}>
              <span
                style={{ background: LINE_META[transfer.line].color }}
                aria-hidden="true"
              />
              <div>
                <small>
                  приблизно о {clockAfter(
                    currentTime,
                    transfer.minutesFromStart <= guide.preBoardMinutes
                      ? transfer.minutesFromStart * 60
                      : (guide.prediction?.seconds ?? 0) +
                          (transfer.minutesFromStart - guide.preBoardMinutes) *
                            60,
                  )}
                </small>
                <strong>
                  Перехід: {STATION_BY_ID[transfer.from].name} →{" "}
                  {STATION_BY_ID[transfer.to].name}
                </strong>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="metro-trip-assistant__arrival">
        <span>Орієнтовне прибуття</span>
        <strong>{clockAfter(currentTime, guide.arrivalSeconds)}</strong>
        <small>{destination.name} · ≈ {tripMinutes} хв у дорозі</small>
      </div>
      <p className="fine-print">
        Таймер побудований за типовими інтервалами руху, а не за даними
        диспетчерської системи. Перед поїздкою перевіряйте оперативні зміни.
      </p>
    </section>
  );
}
