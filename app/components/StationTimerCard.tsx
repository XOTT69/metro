import {
  LINE_META,
  getStationPredictions,
  type Station,
} from "../metro-data";
import { formatTimer } from "./station-time";

export type StationTimerCardProps = {
  station: Station;
  now: Date;
  favorite: boolean;
  onOpen: () => void;
  onFavorite: () => void;
};

/** A compact live board for one station with both travel directions visible. */
export default function StationTimerCard({
  station,
  now,
  favorite,
  onOpen,
  onFavorite,
}: StationTimerCardProps) {
  const predictions = getStationPredictions(station, now);
  const soonest = Math.min(...predictions.map(({ seconds }) => seconds));

  return (
    <article className="station-card station-timer-card">
      <button
        type="button"
        className="station-card__main station-timer-card__main"
        onClick={onOpen}
        aria-label={`Відкрити станцію ${station.name}`}
      >
        <span
          className="line-badge"
          style={{ background: LINE_META[station.line].color }}
        >
          {LINE_META[station.line].code}
        </span>
        <span className="station-timer-card__station">
          <strong>{station.name}</strong>
          <small>{LINE_META[station.line].name}</small>
        </span>
        <span className="station-timer-card__directions">
          {predictions.map((prediction, index) => (
            <span className="station-timer-card__direction" key={prediction.direction}>
              <span>
                <i aria-hidden="true">{index === 0 ? "←" : "→"}</i>
                {prediction.direction}
              </span>
              <b>{formatTimer(prediction.seconds)}</b>
            </span>
          ))}
        </span>
      </button>
      <button
        type="button"
        className="station-card__timer station-timer-card__next"
        onClick={onOpen}
        aria-label={`Найближчий поїзд на станції ${station.name} за ${formatTimer(soonest)}`}
      >
        <small>найближчий</small>
        <strong>{formatTimer(soonest)}</strong>
      </button>
      <button
        type="button"
        className="favorite-button"
        onClick={onFavorite}
        aria-pressed={favorite}
        aria-label={
          favorite
            ? `Прибрати ${station.name} з обраного`
            : `Додати ${station.name} в обране`
        }
      >
        {favorite ? "★" : "☆"}
      </button>
    </article>
  );
}
