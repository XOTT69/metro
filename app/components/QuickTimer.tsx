import {
  LINE_META,
  getStationPredictions,
  type Station,
} from "../metro-data";
import { useNow } from "../hooks/useNow";
import { formatTimer } from "./station-time";

export default function QuickTimer({
  station,
  onOpen,
}: {
  station: Station;
  onOpen: () => void;
}) {
  const now = useNow();
  const seconds = Math.min(
    ...getStationPredictions(station, now).map((prediction) => prediction.seconds),
  );

  return (
    <button
      type="button"
      className="quick-timer"
      onClick={onOpen}
      aria-label={`${LINE_META[station.line].code} · ${station.name} ${formatTimer(seconds)}`}
    >
      <span>
        {LINE_META[station.line].code} · {station.name}
      </span>
      <strong>{formatTimer(seconds)}</strong>
    </button>
  );
}
