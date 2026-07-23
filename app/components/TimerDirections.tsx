import { getStationPredictions, type Station } from "../metro-data";
import { formatFollowing, formatTimer } from "./station-time";

export type TimerDirectionsProps = {
  station: Station;
  now: Date;
  compact?: boolean;
};

export default function TimerDirections({
  station,
  now,
  compact = false,
}: TimerDirectionsProps) {
  const predictions = getStationPredictions(station, now);

  return (
    <div
      className={`timer-directions ${
        compact ? "timer-directions--compact" : ""
      }`}
    >
      {predictions.map((prediction, index) => (
        <div key={prediction.direction} className="direction-timer">
          <div className="direction-timer__head">
            <span aria-hidden="true">{index === 0 ? "←" : "→"}</span>
            <div>
              <small>у напрямку</small>
              <strong>{prediction.direction}</strong>
            </div>
          </div>
          <div className="direction-timer__time">
            <b>{formatTimer(prediction.seconds)}</b>
            <span>о {prediction.clockTime}</span>
          </div>
          {!compact && (
            <small>{formatFollowing(prediction.followingSeconds)}</small>
          )}
        </div>
      ))}
    </div>
  );
}
