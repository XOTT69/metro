import {
  LINE_META,
  LINE_STATIONS,
  type LineId,
} from "../metro-data";

const LINE_IDS: LineId[] = ["red", "blue", "green"];

export type StationSelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
};

export default function StationSelect({
  label,
  value,
  onChange,
  compact = false,
}: StationSelectProps) {
  return (
    <label
      className={`station-field ${compact ? "station-field--compact" : ""}`}
    >
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Оберіть станцію</option>
        {LINE_IDS.map((line) => (
          <optgroup
            key={line}
            label={`${LINE_META[line].code} · ${LINE_META[line].name}`}
          >
            {LINE_STATIONS[line].map((station) => (
              <option key={station.id} value={station.id}>
                {station.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
