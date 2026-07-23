import {
  LINE_META,
  getServiceInterval,
  type Station,
} from "../metro-data";
import { useNow } from "../hooks/useNow";
import StationSelect from "./StationSelect";
import TimerDirections from "./TimerDirections";

export type TrackedStationProps = {
  station: Station;
  now?: Date;
  onOpen: () => void;
  onChange: (id: string) => void;
};

export default function TrackedStation({
  station,
  now,
  onOpen,
  onChange,
}: TrackedStationProps) {
  const currentTime = useNow(now);
  const line = LINE_META[station.line];
  const service = getServiceInterval(currentTime);

  return (
    <section className="tracked-station" aria-labelledby="tracked-station-title">
      <div className="tracked-station__header">
        <div>
          <span className="eyebrow-label">Таймер станції</span>
          <h2 id="tracked-station-title">{station.name}</h2>
        </div>
        <span className="line-chip" style={{ background: line.color }}>
          {line.code}
        </span>
      </div>
      <StationSelect
        compact
        label="Відстежувати іншу"
        value={station.id}
        onChange={onChange}
      />
      <TimerDirections station={station} now={currentTime} />
      <div className="timer-meta">
        <span className={service.isPeak ? "is-peak" : ""}>{service.label}</span>
        <button type="button" onClick={onOpen}>
          Деталі станції →
        </button>
      </div>
    </section>
  );
}
