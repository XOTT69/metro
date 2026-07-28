import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent } from "react";
import {
  LINE_META,
  LINE_STATIONS,
  STATION_BY_ID,
  type LineId,
} from "../metro-data";
import { normalizeStationName } from "../station-search";

const LINE_IDS: LineId[] = ["red", "blue", "green"];
const ALL_STATIONS = LINE_IDS.flatMap((line) => LINE_STATIONS[line]);
const RESULT_LIMIT = 8;

export type StationSelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
};

/**
 * A real text-first station picker. The selected station remains controlled by
 * the parent, while the input temporarily owns only the query currently typed
 * by the person. This keeps route links and browser navigation deterministic.
 */
export default function StationSelect({
  label,
  value,
  onChange,
  compact = false,
}: StationSelectProps) {
  const selectedName = STATION_BY_ID[value]?.name ?? "";
  const [query, setQuery] = useState(selectedName);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const blurTimer = useRef<number | null>(null);
  const inputId = useId();
  const listboxId = useId();

  useEffect(() => {
    setQuery(selectedName);
  }, [selectedName]);

  useEffect(
    () => () => {
      if (blurTimer.current !== null) window.clearTimeout(blurTimer.current);
    },
    [],
  );

  const results = useMemo(() => {
    const normalizedQuery = normalizeStationName(query);
    const matching = normalizedQuery
      ? ALL_STATIONS.filter((station) =>
          normalizeStationName(station.name).includes(normalizedQuery),
        )
      : ALL_STATIONS;
    return matching.slice(0, RESULT_LIMIT);
  }, [query]);

  const choose = (id: string) => {
    const station = STATION_BY_ID[id];
    onChange(id);
    setQuery(station.name);
    setOpen(false);
    setActiveIndex(0);
  };

  const openResults = () => {
    if (blurTimer.current !== null) window.clearTimeout(blurTimer.current);
    setOpen(true);
    setActiveIndex(0);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) setOpen(true);
      else setActiveIndex((current) => Math.min(current + 1, results.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) setOpen(true);
      else setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter" && open && results[activeIndex]) {
      event.preventDefault();
      choose(results[activeIndex].id);
      return;
    }
    if (event.key === "Escape") {
      setQuery(selectedName);
      setOpen(false);
    }
  };

  return (
    <div
      className={`station-field ${compact ? "station-field--compact" : ""}`}
    >
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        type="search"
        value={query}
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-activedescendant={
          open && results[activeIndex]
            ? `${listboxId}-${results[activeIndex].id}`
            : undefined
        }
        placeholder="Введіть назву станції"
        autoComplete="off"
        onFocus={openResults}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          blurTimer.current = window.setTimeout(() => {
            setOpen(false);
            setQuery(selectedName);
          }, 140);
        }}
      />
      {open && (
        <span className="station-options" id={listboxId} role="listbox">
          {results.length ? (
            results.map((station, index) => (
              <button
                key={station.id}
                id={`${listboxId}-${station.id}`}
                type="button"
                role="option"
                aria-selected={station.id === value}
                className={index === activeIndex ? "is-active" : ""}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(station.id)}
              >
                <i style={{ background: LINE_META[station.line].color }} />
                <span>
                  <strong>{station.name}</strong>
                  <small>{LINE_META[station.line].name}</small>
                </span>
              </button>
            ))
          ) : (
            <span className="station-options__empty">Станцію не знайдено</span>
          )}
        </span>
      )}
    </div>
  );
}
