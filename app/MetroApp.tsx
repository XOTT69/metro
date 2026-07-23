"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  LINE_META,
  LINE_STATIONS,
  OFFICIAL_GEOJSON_URL,
  STATION_BY_ID,
  STATIONS,
  TRANSFERS,
  estimateTripMinutes,
  getRoute,
  getServiceInterval,
  getStationPredictions,
  routeTransfers,
  type LineId,
  type Station,
} from "./metro-data";

type Theme = "system" | "light" | "dark";
type View = "planner" | "map" | "stations" | "settings";
type LineFilter = "all" | LineId | "favorites";

const STORAGE = {
  favorites: "metro-kyiv:favorites",
  theme: "metro-kyiv:theme",
  timerStation: "metro-kyiv:timer-station",
};

const LINE_IDS: LineId[] = ["red", "blue", "green"];
const TRANSFER_IDS = new Set(TRANSFERS.flat());
const ukCollator = new Intl.Collator("uk");

function normalizeName(value: string) {
  return value
    .toLocaleLowerCase("uk-UA")
    .replace(/[«»"'’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function MetroLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand ${compact ? "brand--compact" : ""}`}>
      <span className="logo-shell" aria-hidden="true">
        <img src="/metro-logo.svg" alt="" width="30" height="34" />
      </span>
      {!compact && (
        <span>
          <strong>Metro Kyiv</strong>
          <small>метро без зайвого</small>
        </span>
      )}
    </span>
  );
}

function formatTimer(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatFollowing(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  return `ще один приблизно за ${minutes} хв`;
}

function StationSelect({
  label,
  value,
  onChange,
  compact = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <label className={`station-field ${compact ? "station-field--compact" : ""}`}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Оберіть станцію</option>
        {LINE_IDS.map((line) => (
          <optgroup key={line} label={`${LINE_META[line].code} · ${LINE_META[line].name}`}>
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

function MetroMap({
  route,
  onStation,
}: {
  route: string[];
  onStation: (id: string) => void;
}) {
  const [zoom, setZoom] = useState(0.74);
  const [pointedStation, setPointedStation] = useState<string | null>(null);
  const routeSet = new Set(route);
  const highlightedStation =
    STATION_BY_ID[pointedStation || route.at(-1) || route.at(0) || STATIONS[0].id];
  const segments = route.slice(1).map((id, index) => [
    STATION_BY_ID[route[index]],
    STATION_BY_ID[id],
  ]);

  return (
    <div className="map-shell">
      <div className="map-station-inspector" aria-live="polite">
        <span
          className="line-chip"
          style={{ background: LINE_META[highlightedStation.line].color }}
        >
          {LINE_META[highlightedStation.line].code}
        </span>
        <div>
          <small>Обрана станція</small>
          <strong>{highlightedStation.name}</strong>
        </div>
        <button type="button" onClick={() => onStation(highlightedStation.id)}>
          Таймер →
        </button>
      </div>
      <div className="map-toolbar" aria-label="Керування схемою">
        <span>
          <b>{Math.round(zoom * 100)}%</b>
          <small>масштаб</small>
        </span>
        <button
          type="button"
          onClick={() => setZoom((value) => Math.max(0.62, value - 0.1))}
          aria-label="Зменшити масштаб"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => setZoom((value) => Math.min(1.32, value + 0.1))}
          aria-label="Збільшити масштаб"
        >
          +
        </button>
        <button
          type="button"
          className="map-fit-button"
          onClick={() => setZoom(0.74)}
        >
          Вписати
        </button>
      </div>

      <div className="map-scroll" aria-label="Інтерактивна схема метро">
        <svg
          className="metro-map"
          viewBox="0 0 1400 960"
          role="img"
          style={{ width: 1400 * zoom, height: 960 * zoom }}
        >
          <title>Схема Київського метрополітену</title>
          <desc>
            Три чинні лінії, 52 станції та три пересадкові вузли. Обраний маршрут
            виділено жовтим.
          </desc>

          <path
            className="river-shape"
            d="M870 0 C820 170 865 300 860 420 C852 575 820 690 770 960 L1010 960 C1060 760 1045 595 1025 450 C1005 295 1070 155 1110 0 Z"
          />

          <g className="map-zone-labels" aria-hidden="true">
            <text x="905" y="42">правий берег</text>
            <text x="1028" y="42">Дніпро</text>
            <text x="1150" y="42">лівий берег</text>
          </g>

          <g className="network">
            {LINE_IDS.map((line) => (
              <polyline
                key={line}
                points={LINE_STATIONS[line].map(({ x, y }) => `${x},${y}`).join(" ")}
                fill="none"
                stroke={LINE_META[line].color}
                strokeWidth="15"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
          </g>

          <g className="transfer-links">
            {TRANSFERS.map(([a, b]) => (
              <g key={`${a}-${b}`}>
                <line
                  x1={STATION_BY_ID[a].x}
                  y1={STATION_BY_ID[a].y}
                  x2={STATION_BY_ID[b].x}
                  y2={STATION_BY_ID[b].y}
                  className="transfer-link transfer-link--outer"
                />
                <line
                  x1={STATION_BY_ID[a].x}
                  y1={STATION_BY_ID[a].y}
                  x2={STATION_BY_ID[b].x}
                  y2={STATION_BY_ID[b].y}
                  className="transfer-link transfer-link--inner"
                />
              </g>
            ))}
          </g>

          {!!segments.length && (
            <g className="active-route">
              {segments.map(([a, b]) => (
                <line
                  key={`${a.id}-${b.id}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  className={a.line === b.line ? "" : "is-transfer"}
                />
              ))}
            </g>
          )}

          {STATIONS.map((station) => {
            const selected = routeSet.has(station.id);
            return (
              <g
                key={station.id}
                className={`map-station ${selected ? "is-route" : ""}`}
                role="button"
                tabIndex={0}
                aria-label={`${station.name}, ${LINE_META[station.line].name} лінія`}
                onMouseEnter={() => setPointedStation(station.id)}
                onFocus={() => setPointedStation(station.id)}
                onClick={() => onStation(station.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onStation(station.id);
                  }
                }}
              >
                <circle
                  cx={station.x}
                  cy={station.y}
                  r={selected ? 10 : TRANSFER_IDS.has(station.id) ? 9 : 7}
                  fill="var(--map-bg)"
                  stroke={selected ? "var(--route-accent)" : LINE_META[station.line].color}
                  strokeWidth={selected ? 6 : 5}
                />
              </g>
            );
          })}

          {LINE_IDS.map((line) => {
            const first = LINE_STATIONS[line][0];
            const last = LINE_STATIONS[line].at(-1)!;
            return (
              <g key={line} className="line-end-markers" aria-hidden="true">
                <circle cx={first.x} cy={first.y} r="22" fill={LINE_META[line].color} />
                <text x={first.x} y={first.y + 5}>{LINE_META[line].code}</text>
                <circle cx={last.x} cy={last.y} r="22" fill={LINE_META[line].color} />
                <text x={last.x} y={last.y + 5}>{LINE_META[line].code}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function OfficialMapViewer() {
  const [zoom, setZoom] = useState(1);
  return (
    <section className="official-map" aria-labelledby="official-map-title">
      <div className="official-map__toolbar">
        <div>
          <span className="eyebrow-label">Вагонна схема · 2024</span>
          <strong id="official-map-title">Карта високої якості</strong>
        </div>
        <div className="official-map__actions" aria-label="Керування картою">
          <button
            type="button"
            onClick={() => setZoom((value) => Math.max(1, value - 0.25))}
            aria-label="Зменшити карту"
          >
            −
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((value) => Math.min(2.5, value + 0.25))}
            aria-label="Збільшити карту"
          >
            +
          </button>
          <button type="button" onClick={() => setZoom(1)}>
            Вписати
          </button>
          <a href="/kyiv-metro-map-v1.12.3.pdf" target="_blank" rel="noreferrer">
            PDF ↗
          </a>
        </div>
      </div>
      <div className="official-map__scroll">
        <img
          src="/kyiv-metro-map-v1.12.3.png"
          alt="Повна схема Київського метро та швидкісного транспорту, версія 1.12.3 за 2024 рік"
          width="5717"
          height="5977"
          style={{ width: `${zoom * 100}%` }}
        />
      </div>
      <p className="official-map__credit">
        Схема{" "}
        <a
          href="https://a3.kyiv.ua/projects/metromap/"
          target="_blank"
          rel="noreferrer"
        >
          «Агентів змін»
        </a>
        , версія 1.12.3. Відтворена без змін для некомерційного використання.
      </p>
    </section>
  );
}

function TimerDirections({
  station,
  now,
  compact = false,
}: {
  station: Station;
  now: Date;
  compact?: boolean;
}) {
  const predictions = getStationPredictions(station, now);
  return (
    <div className={`timer-directions ${compact ? "timer-directions--compact" : ""}`}>
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
          {!compact && <small>{formatFollowing(prediction.followingSeconds)}</small>}
        </div>
      ))}
    </div>
  );
}

function TrackedStation({
  station,
  now,
  onOpen,
  onChange,
}: {
  station: Station;
  now: Date;
  onOpen: () => void;
  onChange: (id: string) => void;
}) {
  const line = LINE_META[station.line];
  const service = getServiceInterval(now);
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
      <TimerDirections station={station} now={now} />
      <div className="timer-meta">
        <span className={service.isPeak ? "is-peak" : ""}>{service.label}</span>
        <button type="button" onClick={onOpen}>Деталі станції →</button>
      </div>
    </section>
  );
}

function StationSheet({
  station,
  favorite,
  tracked,
  now,
  onFavorite,
  onTrack,
  onUseFrom,
  onUseTo,
  onClose,
}: {
  station: Station;
  favorite: boolean;
  tracked: boolean;
  now: Date;
  onFavorite: () => void;
  onTrack: () => void;
  onUseFrom: () => void;
  onUseTo: () => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const line = LINE_META[station.line];
  const service = getServiceInterval(now);

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !sheetRef.current) return;
      const focusable = Array.from(
        sheetRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], select:not([disabled]), input:not([disabled])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, []);

  return (
    <div className="sheet-backdrop" onMouseDown={onClose}>
      <aside
        ref={sheetRef}
        className="station-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="station-sheet-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          ref={closeRef}
          className="icon-button close-button"
          onClick={onClose}
          aria-label="Закрити інформацію про станцію"
        >
          ×
        </button>
        <div className="station-sheet__line" style={{ color: line.color }}>
          <span>{line.code}</span>
          {line.name} лінія
        </div>
        <h2 id="station-sheet-title">{station.name}</h2>
        <p className="muted">{service.label}</p>
        <TimerDirections station={station} now={now} />

        <div className="station-sheet__actions">
          <button className="primary-button" type="button" onClick={onTrack}>
            {tracked ? "✓ Таймер відстежується" : "◷ Відстежувати таймер"}
          </button>
          <button className="secondary-button" type="button" onClick={onFavorite}>
            {favorite ? "★ В обраному" : "☆ Додати в обране"}
          </button>
          <button className="ghost-button" type="button" onClick={onUseFrom}>
            Звідси
          </button>
          <button className="ghost-button" type="button" onClick={onUseTo}>
            Сюди
          </button>
        </div>

        <p className="fine-print">
          Це прогноз за типовим інтервалом, а не дані диспетчерської системи.
          Затримки, повітряна тривога та оперативні зміни тут не враховані.
        </p>
      </aside>
    </div>
  );
}

function RouteItinerary({
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

function RouteJourney({
  route,
  onStation,
}: {
  route: string[];
  onStation: (id: string) => void;
}) {
  const legs = route.reduce<{ line: LineId; stations: Station[] }[]>((result, id) => {
    const station = STATION_BY_ID[id];
    const current = result.at(-1);
    if (!current || current.line !== station.line) {
      result.push({ line: station.line, stations: [station] });
    } else {
      current.stations.push(station);
    }
    return result;
  }, []);

  return (
    <div className="journey-card">
      <div className="journey-card__summary">
        <span>{route.length} станцій у правильному порядку</span>
        <strong>{legs.length === 1 ? "Без пересадок" : `${legs.length - 1} пересадка`}</strong>
      </div>
      <div className="journey-legs">
        {legs.map((leg, legIndex) => {
          const first = leg.stations[0];
          const last = leg.stations.at(-1)!;
          const firstIndex = LINE_STATIONS[leg.line].findIndex(({ id }) => id === first.id);
          const lastIndex = LINE_STATIONS[leg.line].findIndex(({ id }) => id === last.id);
          const terminal =
            LINE_STATIONS[leg.line][lastIndex >= firstIndex ? LINE_STATIONS[leg.line].length - 1 : 0];
          const directionLabel =
            leg.stations.length === 1
              ? "пересадка та вихід"
              : `у напрямку ${terminal.name}`;
          return (
            <section
              className="journey-leg"
              key={`${leg.line}-${legIndex}`}
              style={{ "--line-color": LINE_META[leg.line].color } as CSSProperties}
            >
              <header>
                <span className="line-chip" style={{ background: LINE_META[leg.line].color }}>
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
                    <button type="button" onClick={() => onStation(station.id)}>
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

export default function MetroApp() {
  const [from, setFrom] = useState("akademmistechko");
  const [to, setTo] = useState("maidan-nezalezhnosti");
  const [view, setView] = useState<View>("planner");
  const [theme, setTheme] = useState<Theme>("system");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [timerStation, setTimerStation] = useState("maidan-nezalezhnosti");
  const [activeStation, setActiveStation] = useState<string | null>(null);
  const [stationSearch, setStationSearch] = useState("");
  const [lineFilter, setLineFilter] = useState<LineFilter>("all");
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [liveCoords, setLiveCoords] = useState<Record<string, [number, number]>>({});
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [toast, setToast] = useState("");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryFrom = params.get("from");
    const queryTo = params.get("to");
    const queryStation = params.get("station");
    const queryView = params.get("view") as View | null;
    if (queryFrom && STATION_BY_ID[queryFrom]) setFrom(queryFrom);
    if (queryTo && STATION_BY_ID[queryTo]) setTo(queryTo);
    if (queryStation && STATION_BY_ID[queryStation]) setActiveStation(queryStation);
    if (queryView && ["planner", "map", "stations", "settings"].includes(queryView)) {
      setView(queryView);
    }

    const savedTheme = localStorage.getItem(STORAGE.theme) as Theme | null;
    const savedTimer = localStorage.getItem(STORAGE.timerStation);
    const savedFavorites = localStorage.getItem(STORAGE.favorites);
    if (savedTheme && ["system", "light", "dark"].includes(savedTheme)) {
      setTheme(savedTheme);
    }
    if (savedTimer && STATION_BY_ID[savedTimer]) setTimerStation(savedTimer);
    if (savedFavorites) {
      try {
        const parsed = JSON.parse(savedFavorites);
        if (Array.isArray(parsed)) {
          setFavorites(parsed.filter((id) => typeof id === "string" && STATION_BY_ID[id]));
        }
      } catch {
        localStorage.removeItem(STORAGE.favorites);
      }
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    fetch(OFFICIAL_GEOJSON_URL)
      .then((response) => {
        if (!response.ok) throw new Error("geojson");
        return response.json();
      })
      .then((data) => {
        const coordinates: Record<string, [number, number]> = {};
        const stationsByName = new Map(
          STATIONS.map((station) => [normalizeName(station.name), station]),
        );
        for (const feature of data.features || []) {
          const rawName =
            feature.properties?.name ||
            feature.properties?.NAME ||
            feature.properties?.station_name ||
            "";
          const station = stationsByName.get(normalizeName(String(rawName)));
          const point = feature.geometry?.coordinates;
          if (station && Array.isArray(point) && point.length >= 2) {
            coordinates[station.id] = [Number(point[1]), Number(point[0])];
          }
        }
        setLiveCoords(coordinates);
      })
      .catch(() => undefined);

    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
    localStorage.setItem(STORAGE.theme, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(STORAGE.favorites, JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem(STORAGE.timerStation, timerStation);
  }, [timerStation]);

  const route = useMemo(() => getRoute(from, to), [from, to]);
  const transfers = routeTransfers(route);
  const stationsCount = Math.max(0, route.length - 1);
  const tripMinutes = estimateTripMinutes(route);
  const sortedStations = useMemo(
    () => [...STATIONS].sort((a, b) => ukCollator.compare(a.name, b.name)),
    [],
  );
  const filteredStations = useMemo(() => {
    const query = normalizeName(stationSearch);
    return sortedStations.filter((station) => {
      const matchesQuery = !query || normalizeName(station.name).includes(query);
      const matchesLine =
        lineFilter === "all" ||
        (lineFilter === "favorites"
          ? favorites.includes(station.id)
          : station.line === lineFilter);
      return matchesQuery && matchesLine;
    });
  }, [favorites, lineFilter, sortedStations, stationSearch]);
  const quickTimerSeconds = Math.min(
    ...getStationPredictions(STATION_BY_ID[timerStation], now).map(
      ({ seconds }) => seconds,
    ),
  );

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  const chooseView = (nextView: View) => {
    setView(nextView);
    const url = new URL(window.location.href);
    if (nextView === "planner") url.searchParams.delete("view");
    else url.searchParams.set("view", nextView);
    window.history.replaceState({}, "", url);
  };

  const toggleFavorite = (id: string) => {
    setFavorites((current) =>
      current.includes(id)
        ? current.filter((stationId) => stationId !== id)
        : [...current, id],
    );
  };

  const openStation = (id: string) => {
    setActiveStation(id);
    const url = new URL(window.location.href);
    url.searchParams.set("station", id);
    window.history.replaceState({}, "", url);
  };

  const closeStation = () => {
    setActiveStation(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("station");
    window.history.replaceState({}, "", url);
  };

  const trackStation = (id: string) => {
    setTimerStation(id);
    showToast(`Таймер: ${STATION_BY_ID[id].name}`);
  };

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const shareRoute = async () => {
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("from", from);
    url.searchParams.set("to", to);
    const shareData = {
      title: "Маршрут у Metro Kyiv",
      text: `${STATION_BY_ID[from].name} → ${STATION_BY_ID[to].name}, ≈ ${tripMinutes} хв`,
      url: url.toString(),
    };
    const canShare = typeof navigator.share === "function";
    try {
      if (canShare) await navigator.share(shareData);
      else await navigator.clipboard.writeText(url.toString());
      showToast(canShare ? "Маршрут готовий до поширення" : "Посилання скопійовано");
    } catch {
      // The user may dismiss the native share sheet.
    }
  };

  const findNearest = () => {
    if (!navigator.geolocation) {
      showToast("Геолокація не підтримується цим браузером");
      return;
    }
    setGeoStatus("loading");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const nearest = STATIONS.reduce(
          (best, station) => {
            const [lat, lon] = liveCoords[station.id] || [station.lat, station.lon];
            const distance =
              Math.pow(lat - coords.latitude, 2) +
              Math.pow((lon - coords.longitude) * 0.65, 2);
            return distance < best.distance ? { station, distance } : best;
          },
          { station: STATIONS[0], distance: Infinity },
        ).station;
        setFrom(nearest.id);
        setTimerStation(nearest.id);
        setGeoStatus("ready");
        showToast(`Найближча: ${nearest.name}`);
      },
      () => {
        setGeoStatus("error");
        showToast("Не вдалося отримати геопозицію");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const triggerInstall = async () => {
    if (!installPrompt) {
      showToast("У меню браузера оберіть «Встановити застосунок»");
      return;
    }
    const promptEvent = installPrompt as Event & { prompt: () => Promise<void> };
    await promptEvent.prompt();
    setInstallPrompt(null);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <MetroLogo />
        <nav className="desktop-nav" aria-label="Головна навігація">
          {(
            [
              ["planner", "Маршрут"],
              ["map", "Схема"],
              ["stations", "Станції й таймери"],
              ["settings", "Налаштування"],
            ] as [View, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              className={view === id ? "is-active" : ""}
              onClick={() => chooseView(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="top-actions">
          <span className="status-pill">
            <i /> PWA · офлайн
          </span>
          <button
            type="button"
            className="quick-timer"
            onClick={() => openStation(timerStation)}
            aria-label={`Відкрити таймер станції ${STATION_BY_ID[timerStation].name}`}
          >
            <span>
              {LINE_META[STATION_BY_ID[timerStation].line].code} ·{" "}
              {STATION_BY_ID[timerStation].name}
            </span>
            <strong>{formatTimer(quickTimerSeconds)}</strong>
          </button>
          <button className="install-button" onClick={triggerInstall}>
            Встановити
          </button>
        </div>
      </header>

      {view === "planner" && (
        <div className="workspace">
          <section className="planner-panel">
            <div className="eyebrow">
              <span>52 станції</span>
              <span>3 лінії</span>
              <span>оновлені назви</span>
            </div>
            <h1>
              Маршрут Києвом
              <br />
              без <em>метушні.</em>
            </h1>
            <p className="intro">
              Оберіть станції — побачите найкоротший шлях, пересадки, час і
              зрозумілу схему поїздки.
            </p>

            <div className="route-form">
              <div className="route-dot route-dot--from" />
              <StationSelect label="Звідки" value={from} onChange={setFrom} />
              <button
                className="swap-button"
                onClick={swap}
                aria-label="Поміняти станції місцями"
              >
                ⇅
              </button>
              <div className="route-dot route-dot--to" />
              <StationSelect label="Куди" value={to} onChange={setTo} />
              <button className="nearest-button" onClick={findNearest}>
                ◎ {geoStatus === "loading" ? "Визначаємо…" : "Моя найближча станція"}
              </button>
            </div>

            <section className="route-summary" aria-live="polite">
              <div className="summary-main">
                <span>Орієнтовна поїздка</span>
                <strong>≈ {tripMinutes} хв</strong>
              </div>
              <div className="summary-stats">
                <div>
                  <strong>{stationsCount}</strong>
                  <span>перегонів</span>
                </div>
                <div>
                  <strong>{transfers}</strong>
                  <span>{transfers === 1 ? "пересадка" : "пересадки"}</span>
                </div>
                <div>
                  <strong>{route.length}</strong>
                  <span>точок маршруту</span>
                </div>
              </div>
              <div className="route-actions">
                <button className="primary-button" onClick={() => chooseView("map")}>
                  Відкрити велику схему
                </button>
                <button className="secondary-button" onClick={shareRoute}>
                  Поділитися
                </button>
              </div>
              <details className="route-details">
                <summary>Усі станції маршруту</summary>
                <RouteItinerary route={route} onStation={openStation} />
              </details>
            </section>

            <TrackedStation
              station={STATION_BY_ID[timerStation]}
              now={now}
              onOpen={() => openStation(timerStation)}
              onChange={trackStation}
            />
          </section>

          <section className="map-panel">
            <div className="map-panel__header">
              <div>
                <span className="eyebrow-label">Поїздка крок за кроком</span>
                <h2>
                  {STATION_BY_ID[from].name} → {STATION_BY_ID[to].name}
                </h2>
              </div>
              <div className="map-legend">
                {LINE_IDS.map((line) => (
                  <span key={line}>
                    <i style={{ background: LINE_META[line].color }} />
                    {LINE_META[line].code}
                  </span>
                ))}
              </div>
            </div>
            <RouteJourney route={route} onStation={openStation} />
            <div className="map-caption">
              <span>Маршрут розкладено за лініями та пересадками</span>
              <strong>Натисніть назву станції — відкриється її таймер</strong>
            </div>
          </section>
        </div>
      )}

      {view === "map" && (
        <section className="full-map-view">
          <div className="section-heading">
            <div>
              <span className="eyebrow-label">Висока якість · актуальна версія</span>
              <h1>Чітка схема метро</h1>
              <p>
                Повна вагонна карта у високій роздільності. Збільшуйте її до 250% —
                назви не накладаються і залишаються читабельними.
              </p>
            </div>
            <button className="primary-button" onClick={() => chooseView("planner")}>
              ← До маршруту
            </button>
          </div>
          <div className="full-map-routebar">
            <StationSelect compact label="Звідки" value={from} onChange={setFrom} />
            <button type="button" onClick={swap} aria-label="Поміняти станції місцями">
              ⇄
            </button>
            <StationSelect compact label="Куди" value={to} onChange={setTo} />
            <span>≈ {tripMinutes} хв · {transfers} перес.</span>
          </div>
          <OfficialMapViewer />
          <details className="interactive-map-details">
            <summary>
              <span>
                <strong>Інтерактивний маршрут</strong>
                <small>Станції без підписів поверх ліній — назва показується окремо</small>
              </span>
              <span aria-hidden="true">Розгорнути ↓</span>
            </summary>
            <div className="interactive-map-frame">
              <MetroMap route={route} onStation={openStation} />
            </div>
          </details>
        </section>
      )}

      {view === "stations" && (
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
            station={STATION_BY_ID[timerStation]}
            now={now}
            onOpen={() => openStation(timerStation)}
            onChange={trackStation}
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
                    onClick={() => openStation(station.id)}
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
                    onClick={() => trackStation(station.id)}
                    aria-label={`Відстежувати таймер станції ${station.name}`}
                  >
                    <small>{timerStation === station.id ? "відстежується" : "найближчий"}</small>
                    <strong>{formatTimer(next)}</strong>
                  </button>
                  <button
                    type="button"
                    className="favorite-button"
                    onClick={() => toggleFavorite(station.id)}
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
      )}

      {view === "settings" && (
        <section className="settings-view">
          <div className="section-heading">
            <div>
              <span className="eyebrow-label">Під вас</span>
              <h1>Налаштування</h1>
              <p>Усе зберігається лише на цьому пристрої.</p>
            </div>
          </div>
          <div className="settings-card">
            <h2>Тема оформлення</h2>
            <div className="theme-switcher" role="radiogroup" aria-label="Тема оформлення">
              {(
                [
                  ["light", "☀ Світла"],
                  ["dark", "☾ Темна"],
                  ["system", "◐ Системна"],
                ] as [Theme, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  role="radio"
                  aria-checked={theme === id}
                  className={theme === id ? "is-active" : ""}
                  onClick={() => setTheme(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="settings-card">
            <h2>Як працює таймер</h2>
            <p>
              Це математичний прогноз, синхронізований із поточним часом,
              напрямком, положенням станції на лінії та типовим інтервалом.
              Він не підключений до диспетчерської системи.
            </p>
            <p>
              Використані актуальні публічні інтервали: 2:30–3:30 у будні в
              години пік, 5–6 хв у міжпік та 6–7 хв у вихідні.
            </p>
            <a
              className="source-link"
              href="https://kyivcity.gov.ua/news/minulogo_tizhnya_stolichnim_metro_skoristalisya_ponad_51_milyona_pasazhiriv_iz_yakikh_mayzhe_14_milyona__pilgoviki/"
              target="_blank"
              rel="noreferrer"
            >
              Джерело інтервалів: Портал Києва ↗
            </a>
          </div>
          <div className="settings-card">
            <h2>Карта та дані</h2>
            <p>
              Координати автоматично уточнюються з відкритого GeoJSON API Києва;
              без мережі використовується локальний набір. Геолокація потрібна
              лише для пошуку найближчої станції й нікуди не надсилається.
            </p>
            <div className="source-list">
              <a href="https://guide.kyivcity.gov.ua/faq/karta-metro" target="_blank" rel="noreferrer">
                Kyiv City Guide ↗
              </a>
              <a
                href="https://a3.kyiv.ua/projects/metromap/license/assets/metromap_wagon_660x690_v1.8.8.pdf"
                target="_blank"
                rel="noreferrer"
              >
                Вагонна схема «Агенти змін» ↗
              </a>
              <a href="https://inmetro.pp.ua/uk/Kyiv.php" target="_blank" rel="noreferrer">
                Інтерактивний довідник inMetro ↗
              </a>
            </div>
          </div>
          <div className="settings-card">
            <h2>Встановити Metro Kyiv</h2>
            <p>
              Після встановлення застосунок відкривається з домашнього екрана,
              пам’ятає обрані станції та працює без інтернету.
            </p>
            <button className="primary-button" onClick={triggerInstall}>
              Встановити PWA
            </button>
          </div>
        </section>
      )}

      {activeStation && (
        <StationSheet
          key={activeStation}
          station={STATION_BY_ID[activeStation]}
          now={now}
          favorite={favorites.includes(activeStation)}
          tracked={timerStation === activeStation}
          onFavorite={() => toggleFavorite(activeStation)}
          onTrack={() => trackStation(activeStation)}
          onUseFrom={() => {
            setFrom(activeStation);
            closeStation();
            chooseView("planner");
          }}
          onUseTo={() => {
            setTo(activeStation);
            closeStation();
            chooseView("planner");
          }}
          onClose={closeStation}
        />
      )}

      <nav className="mobile-nav" aria-label="Мобільна навігація">
        {(
          [
            ["planner", "⌁", "Маршрут"],
            ["map", "◇", "Схема"],
            ["stations", "◷", "Таймери"],
            ["settings", "⚙", "Параметри"],
          ] as [View, string, string][]
        ).map(([id, icon, label]) => (
          <button
            key={id}
            className={view === id ? "is-active" : ""}
            onClick={() => chooseView(id)}
          >
            <span>{icon}</span>
            {label}
          </button>
        ))}
      </nav>

      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
