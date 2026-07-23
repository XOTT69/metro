"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  LINE_META,
  LINE_STATIONS,
  OFFICIAL_GEOJSON_URL,
  STATION_BY_ID,
  STATIONS,
  TRANSFERS,
  getRoute,
  routeTransfers,
  type LineId,
  type Station,
} from "./metro-data";

type Theme = "system" | "light" | "dark";
type View = "planner" | "map" | "stations" | "settings";

const STORAGE = {
  favorites: "metro-kyiv:favorites",
  theme: "metro-kyiv:theme",
};

const ukCollator = new Intl.Collator("uk");

function linePath(line: LineId) {
  return LINE_STATIONS[line].map(({ x, y }) => `${x},${y}`).join(" ");
}

function MetroLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand ${compact ? "brand--compact" : ""}`}>
      <span className="logo-shell">
        <Image src="/metro-logo.svg" alt="" width={30} height={34} priority />
      </span>
      {!compact && (
        <span>
          <strong>Metro Kyiv</strong>
          <small>планувальник поїздок</small>
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

function nextTrainSeconds(station: Station) {
  const now = new Date();
  const elapsed =
    now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const seed = station.name.length * 19 + station.x;
  const interval = 240 + (seed % 90);
  return (interval - (elapsed + seed) % interval) % interval;
}

function StationSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="station-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Оберіть станцію</option>
        {(["red", "blue", "green"] as LineId[]).map((line) => (
          <optgroup key={line} label={LINE_META[line].name}>
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
  const routeSet = new Set(route);
  const segments = route.slice(1).map((id, index) => [
    STATION_BY_ID[route[index]],
    STATION_BY_ID[id],
  ]);

  return (
    <div className="map-scroll" aria-label="Інтерактивна схема метро">
      <svg className="metro-map" viewBox="0 0 960 780" role="img">
        <title>Схема Київського метрополітену</title>
        <desc>
          Три лінії та 52 станції. Обраний маршрут підсвічено білою лінією.
        </desc>
        <g className="network network--muted">
          {(["red", "blue", "green"] as LineId[]).map((line) => (
            <polyline
              key={line}
              points={linePath(line)}
              fill="none"
              stroke={LINE_META[line].color}
              strokeWidth="12"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {TRANSFERS.map(([a, b]) => (
            <line
              key={`${a}-${b}`}
              x1={STATION_BY_ID[a].x}
              y1={STATION_BY_ID[a].y}
              x2={STATION_BY_ID[b].x}
              y2={STATION_BY_ID[b].y}
              className="transfer-link"
            />
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
          const labelAbove = station.line === "red";
          const labelRight = station.line === "blue";
          const selected = routeSet.has(station.id);
          return (
            <g
              key={station.id}
              className={`map-station ${selected ? "is-route" : ""}`}
              role="button"
              tabIndex={0}
              aria-label={`${station.name}, ${LINE_META[station.line].name} лінія`}
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
                r={selected ? 8 : 6}
                fill="var(--map-bg)"
                stroke={selected ? "var(--route-accent)" : LINE_META[station.line].color}
                strokeWidth={selected ? 5 : 4}
              />
              <text
                x={station.x + (labelRight ? 13 : 0)}
                y={station.y + (labelAbove ? -14 : labelRight ? 4 : 19)}
                textAnchor={labelRight ? "start" : "middle"}
                className="station-label"
              >
                {station.short || station.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function StationSheet({
  station,
  favorite,
  onFavorite,
  onClose,
}: {
  station: Station;
  favorite: boolean;
  onFavorite: () => void;
  onClose: () => void;
}) {
  const [seconds, setSeconds] = useState(() => nextTrainSeconds(station));

  useEffect(() => {
    const timer = window.setInterval(
      () => setSeconds(nextTrainSeconds(station)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [station]);

  const line = LINE_META[station.line];
  return (
    <aside className="station-sheet" aria-label={`Станція ${station.name}`}>
      <button className="icon-button close-button" onClick={onClose} aria-label="Закрити">
        ×
      </button>
      <div className="station-sheet__line" style={{ color: line.color }}>
        <span>{line.code}</span>
        {line.name}
      </div>
      <h2>{station.name}</h2>
      <p className="muted">Наступний поїзд за розрахунковим інтервалом</p>
      <div className="timer" aria-live="polite">
        <strong>{formatTimer(seconds)}</strong>
        <span>орієнтовно</span>
      </div>
      <div className="direction-grid">
        {line.terminus.map((terminus, index) => (
          <div key={terminus}>
            <small>у напрямку</small>
            <strong>{terminus}</strong>
            <span>{formatTimer((seconds + index * 97) % 330)}</span>
          </div>
        ))}
      </div>
      <button className="secondary-button full" onClick={onFavorite}>
        {favorite ? "★ В обраному" : "☆ Додати в обране"}
      </button>
      <p className="fine-print">
        Таймер розрахунковий і не відображає затримки чи оперативні зміни руху.
      </p>
    </aside>
  );
}

export default function MetroApp() {
  const [from, setFrom] = useState("akademmistechko");
  const [to, setTo] = useState("maidan-nezalezhnosti");
  const [view, setView] = useState<View>("planner");
  const [theme, setTheme] = useState<Theme>("system");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [activeStation, setActiveStation] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [liveCoords, setLiveCoords] = useState<Record<string, [number, number]>>({});
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
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
      const savedFavorites = localStorage.getItem(STORAGE.favorites);
      if (savedTheme) setTheme(savedTheme);
      if (savedFavorites) {
        try {
          setFavorites(JSON.parse(savedFavorites));
        } catch {}
      }
    }, 0);

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
        for (const feature of data.features || []) {
          const name = String(feature.properties?.name || "").toLowerCase();
          const station = STATIONS.find(
            (item) => item.name.toLowerCase() === name,
          );
          const point = feature.geometry?.coordinates;
          if (station && Array.isArray(point)) {
            coordinates[station.id] = [point[1], point[0]];
          }
        }
        setLiveCoords(coordinates);
      })
      .catch(() => undefined);

    return () => {
      window.clearTimeout(hydrationTimer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE.theme, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(STORAGE.favorites, JSON.stringify(favorites));
  }, [favorites]);

  const route = useMemo(() => getRoute(from, to), [from, to]);
  const transfers = routeTransfers(route);
  const stationsCount = Math.max(0, route.length - 1);
  const tripMinutes = Math.max(
    0,
    Math.round(stationsCount * 2.4 + transfers * 4),
  );

  const routeStops = route.map((id) => STATION_BY_ID[id]);
  const transferStops = routeStops.filter(
    (station, index) =>
      index > 0 && routeStops[index - 1].line !== station.line,
  );

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
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
    try {
      if (navigator.share) await navigator.share(shareData);
      else await navigator.clipboard.writeText(url.toString());
      showToast(navigator.share ? "Маршрут готовий до поширення" : "Посилання скопійовано");
    } catch {}
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
      showToast("Відкрийте меню браузера та оберіть «Встановити застосунок»");
      return;
    }
    const promptEvent = installPrompt as Event & { prompt: () => Promise<void> };
    await promptEvent.prompt();
    setInstallPrompt(null);
  };

  const sortedStations = [...STATIONS].sort((a, b) =>
    ukCollator.compare(a.name, b.name),
  );

  return (
    <main className="app-shell">
      <header className="topbar">
        <MetroLogo />
        <nav className="desktop-nav" aria-label="Головна навігація">
          {(
            [
              ["planner", "Маршрут"],
              ["map", "Схема"],
              ["stations", "Станції"],
              ["settings", "Налаштування"],
            ] as [View, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              className={view === id ? "is-active" : ""}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="top-actions">
          <span className="status-pill">
            <i /> офлайн готовий
          </span>
          <button className="install-button" onClick={triggerInstall}>
            ↓ Встановити
          </button>
        </div>
      </header>

      {view === "planner" && (
        <div className="workspace">
          <section className="planner-panel">
            <div className="eyebrow">
              <span>52 станції</span>
              <span>3 лінії</span>
              <span>працює офлайн</span>
            </div>
            <h1>
              Київ — ближче,
              <br />
              коли маршрут <em>простий.</em>
            </h1>
            <p className="intro">
              Побудуйте найкоротший шлях метро, побачте пересадки й час —
              навіть без інтернету.
            </p>

            <div className="route-form">
              <div className="route-dot route-dot--from" />
              <StationSelect label="Звідки" value={from} onChange={setFrom} />
              <button className="swap-button" onClick={swap} aria-label="Поміняти станції місцями">
                ⇅
              </button>
              <div className="route-dot route-dot--to" />
              <StationSelect label="Куди" value={to} onChange={setTo} />
              <button className="nearest-button" onClick={findNearest}>
                ◎ {geoStatus === "loading" ? "Шукаємо…" : "Найближча станція"}
              </button>
            </div>

            <section className="route-summary" aria-live="polite">
              <div className="summary-main">
                <span>ваша поїздка</span>
                <strong>≈ {tripMinutes} хв</strong>
              </div>
              <div className="summary-stats">
                <div>
                  <strong>{stationsCount}</strong>
                  <span>станцій</span>
                </div>
                <div>
                  <strong>{transfers}</strong>
                  <span>{transfers === 1 ? "пересадка" : "пересадки"}</span>
                </div>
              </div>
              {transferStops.length > 0 && (
                <div className="transfer-note">
                  <span>↗</span>
                  <div>
                    <small>Пересідайте на</small>
                    <strong>
                      {transferStops.map((station) => LINE_META[station.line].code).join(", ")}
                    </strong>
                  </div>
                </div>
              )}
              <div className="route-actions">
                <button className="primary-button" onClick={() => setView("map")}>
                  Показати на схемі
                </button>
                <button className="secondary-button" onClick={shareRoute}>
                  ↗ Поділитися
                </button>
              </div>
            </section>

            {favorites.length > 0 && (
              <div className="favorites-strip">
                <span>Обрані</span>
                {favorites.slice(0, 3).map((id) => (
                  <button key={id} onClick={() => setFrom(id)}>
                    ★ {STATION_BY_ID[id].name}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="map-panel">
            <div className="map-panel__header">
              <div>
                <span className="eyebrow-label">Жива схема</span>
                <h2>Ваш маршрут</h2>
              </div>
              <div className="map-legend">
                {(["red", "blue", "green"] as LineId[]).map((line) => (
                  <span key={line}>
                    <i style={{ background: LINE_META[line].color }} />
                    {LINE_META[line].code}
                  </span>
                ))}
              </div>
            </div>
            <MetroMap route={route} onStation={openStation} />
            <div className="map-caption">
              <span>Натисніть станцію, щоб побачити деталі</span>
              <strong>{STATION_BY_ID[from].name} → {STATION_BY_ID[to].name}</strong>
            </div>
          </section>
        </div>
      )}

      {view === "map" && (
        <section className="full-map-view">
          <div className="section-heading">
            <div>
              <span className="eyebrow-label">Інтерактивна схема</span>
              <h1>Усе метро Києва</h1>
              <p>Натисніть на станцію для таймера, напрямків та обраного.</p>
            </div>
            <button className="primary-button" onClick={() => setView("planner")}>
              ← До маршруту
            </button>
          </div>
          <MetroMap route={route} onStation={openStation} />
        </section>
      )}

      {view === "stations" && (
        <section className="stations-view">
          <div className="section-heading">
            <div>
              <span className="eyebrow-label">Довідник</span>
              <h1>Усі 52 станції</h1>
              <p>Швидкий доступ до таймера, лінії та напрямків руху.</p>
            </div>
          </div>
          <div className="station-grid">
            {sortedStations.map((station) => (
              <button
                key={station.id}
                className="station-card"
                onClick={() => openStation(station.id)}
              >
                <span
                  className="line-badge"
                  style={{ background: LINE_META[station.line].color }}
                >
                  {LINE_META[station.line].code}
                </span>
                <strong>{station.name}</strong>
                <span>{favorites.includes(station.id) ? "★" : "→"}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {view === "settings" && (
        <section className="settings-view">
          <div className="section-heading">
            <div>
              <span className="eyebrow-label">Під вас</span>
              <h1>Налаштування</h1>
              <p>Вибір зберігається лише на цьому пристрої.</p>
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
            <h2>Дані та приватність</h2>
            <p>
              Геолокація використовується тільки для пошуку найближчої станції
              й нікуди не надсилається. Обрані станції зберігаються в localStorage.
            </p>
            <p>
              Координати автоматично уточнюються з відкритого GeoJSON API Києва;
              без мережі застосунок використовує локальний набір.
            </p>
          </div>
          <div className="settings-card">
            <h2>Встановити Metro Kyiv</h2>
            <p>Після встановлення застосунок відкривається з домашнього екрана і працює офлайн.</p>
            <button className="primary-button" onClick={triggerInstall}>↓ Встановити PWA</button>
          </div>
        </section>
      )}

      {activeStation && (
        <StationSheet
          key={activeStation}
          station={STATION_BY_ID[activeStation]}
          favorite={favorites.includes(activeStation)}
          onFavorite={() => toggleFavorite(activeStation)}
          onClose={closeStation}
        />
      )}

      <nav className="mobile-nav" aria-label="Мобільна навігація">
        {(
          [
            ["planner", "⌁", "Маршрут"],
            ["map", "◇", "Схема"],
            ["stations", "●", "Станції"],
            ["settings", "⚙", "Параметри"],
          ] as [View, string, string][]
        ).map(([id, icon, label]) => (
          <button
            key={id}
            className={view === id ? "is-active" : ""}
            onClick={() => setView(id)}
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
