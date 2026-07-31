import { useEffect, useState } from "react";
import {
  LINE_META,
  LINE_STATIONS,
  STATION_BY_ID,
  estimateTripMinutes,
  getRoute,
  getServiceInterval,
  getStationPredictions,
  routeTransfers,
  type LineId,
  type ServiceDay,
  type Station,
} from "./metro-data";
import { formatTimer } from "./components/station-time";

type View = "schedule" | "map" | "about" | "settings";
type Theme = "light" | "dark" | "system";

const lineIds: LineId[] = ["red", "blue", "green"];
const kyivFormatter = new Intl.DateTimeFormat("uk-UA", {
  timeZone: "Europe/Kyiv",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function clockTime(date: Date) {
  return date.toLocaleTimeString("uk-UA", {
    timeZone: "Europe/Kyiv",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitialDay(now: Date): ServiceDay {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Kyiv",
    weekday: "short",
  }).format(now);
  return weekday === "Sat" || weekday === "Sun" ? "weekend" : "weekday";
}

function MetroMark() {
  return <span className="metro-mark" aria-hidden="true">М</span>;
}

function StationPicker({
  stationId,
  onChange,
  label = "Станція",
}: {
  stationId: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const [query, setQuery] = useState(STATION_BY_ID[stationId].name);
  const [isOpen, setIsOpen] = useState(false);
  const normalizedQuery = query.trim().toLocaleLowerCase("uk-UA");

  useEffect(() => {
    setQuery(STATION_BY_ID[stationId].name);
  }, [stationId]);

  return (
    <div className={`station-picker ${isOpen ? "is-open" : ""}`}>
      <label>
        <span>{label}</span>
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
          placeholder="Почніть вводити назву"
          aria-label={label}
          aria-expanded={isOpen}
          aria-controls={`${label}-stations`}
        />
        <i aria-hidden="true">⌕</i>
      </label>
      {isOpen && (
        <div className="station-results" id={`${label}-stations`}>
          {lineIds.map((line) => {
            const stations = LINE_STATIONS[line].filter((station) =>
              station.name.toLocaleLowerCase("uk-UA").includes(normalizedQuery),
            );
            if (!stations.length) return null;
            return (
              <section key={line}>
                <header><i style={{ backgroundColor: LINE_META[line].color }} />{LINE_META[line].code}<span>{LINE_META[line].name}</span></header>
                {stations.map((station) => (
                  <button
                    type="button"
                    key={station.id}
                    className={station.id === stationId ? "is-selected" : ""}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onChange(station.id);
                      setIsOpen(false);
                    }}
                  >
                    {station.name}
                  </button>
                ))}
              </section>
            );
          })}
          {!lineIds.some((line) => LINE_STATIONS[line].some((station) => station.name.toLocaleLowerCase("uk-UA").includes(normalizedQuery))) && <p>Нічого не знайдено. Спробуйте іншу назву.</p>}
        </div>
      )}
    </div>
  );
}

function DirectionCard({
  station,
  directionIndex,
  active,
  now,
  day,
  onClick,
}: {
  station: Station;
  directionIndex: number;
  active: boolean;
  now: Date;
  day: ServiceDay;
  onClick: () => void;
}) {
  const prediction = getStationPredictions(station, now, day)[directionIndex];
  return (
    <button className={`direction-card ${active ? "is-active" : ""}`} onClick={onClick}>
      <span className="direction-card__top">
        <span>{directionIndex === 0 ? "←" : "→"} Напрямок</span>
        <i style={{ backgroundColor: LINE_META[station.line].color }} />
      </span>
      <strong>{prediction.direction}</strong>
      <small>наступний орієнтовно о {prediction.clockTime}</small>
      <b>{formatTimer(prediction.seconds)}</b>
    </button>
  );
}

function MetroMap() {
  const [zoom, setZoom] = useState(1);
  return (
    <section className="map-panel" aria-label="Схема київського метро">
      <div className="map-panel__heading">
        <p className="eyebrow">Офіційна схема</p>
        <h1>Карта метро</h1>
        <span>Збільшуйте та переміщайте карту жестами або кнопками.</span>
      </div>
      <div className="map-photo" aria-label="Оригінальна карта київського метро">
        <div className="map-zoom-controls">
          <button onClick={() => setZoom((value) => Math.max(1, value - 0.25))} disabled={zoom === 1} aria-label="Віддалити карту">−</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((value) => Math.min(3, value + 0.25))} disabled={zoom === 3} aria-label="Збільшити карту">+</button>
        </div>
        <div className="map-photo__canvas">
          <img src="/kyiv-metro-map-v1.12.3.png" alt="Офіційна схема Київського метро та швидкісного транспорту" style={{ width: `${zoom * 100}%` }} />
        </div>
      </div>
      <p className="map-note">Версія схеми 1.12.3 · метро, швидкісний трамвай та міська електричка.</p>
    </section>
  );
}

export default function MetroApp() {
  const [view, setView] = useState<View>("schedule");
  const [now, setNow] = useState(() => new Date());
  const [stationId, setStationId] = useState("khreshchatyk");
  const [toId, setToId] = useState("maidan-nezalezhnosti");
  const [direction, setDirection] = useState(0);
  const [day, setDay] = useState<ServiceDay>(() => getInitialDay(new Date()));
  const [favorites, setFavorites] = useState<string[]>([]);
  const [theme, setTheme] = useState<Theme>("system");
  const [showBoth, setShowBoth] = useState(true);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const storedFavorites = window.localStorage.getItem("metro-kyiv:favorites");
    const storedTheme = window.localStorage.getItem("metro-kyiv:theme") as Theme | null;
    const storedBoth = window.localStorage.getItem("metro-kyiv:both-directions");
    if (storedFavorites) setFavorites(JSON.parse(storedFavorites));
    if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") setTheme(storedTheme);
    if (storedBoth) setShowBoth(storedBoth === "true");
  }, []);

  useEffect(() => {
    window.localStorage.setItem("metro-kyiv:favorites", JSON.stringify(favorites));
  }, [favorites]);
  useEffect(() => {
    window.localStorage.setItem("metro-kyiv:theme", theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    window.localStorage.setItem("metro-kyiv:both-directions", String(showBoth));
  }, [showBoth]);
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  const station = STATION_BY_ID[stationId];
  const destination = STATION_BY_ID[toId];
  const route = getRoute(stationId, toId);
  const tripMinutes = estimateTripMinutes(route);
  const transfers = routeTransfers(route);
  const nextRouteStation = route[1] ? STATION_BY_ID[route[1]] : undefined;
  const recommendedDirection = nextRouteStation?.line === station.line
    ? LINE_META[station.line].terminus[
        LINE_STATIONS[station.line].findIndex(({ id }) => id === nextRouteStation.id) >
        LINE_STATIONS[station.line].findIndex(({ id }) => id === station.id)
          ? 1
          : 0
      ]
    : null;
  const predictions = getStationPredictions(station, now, day);
  const activePrediction = predictions[direction];
  const interval = getServiceInterval(now, day);
  const schedule = Array.from({ length: 8 }, (_, index) =>
    clockTime(
      new Date(
        now.getTime() +
          (activePrediction.seconds + index * activePrediction.intervalSeconds) *
            1000,
      ),
    ),
  );
  const favorite = favorites.includes(stationId);

  const swapStations = () => {
    setStationId(toId);
    setToId(stationId);
  };
  const toggleFavorite = () => setFavorites((items) => favorite ? items.filter((id) => id !== stationId) : [...items, stationId]);
  const shareStation = async () => {
    const url = `${window.location.origin}/?station=${stationId}`;
    if (navigator.share) await navigator.share({ title: `Метро Київ — ${station.name}`, url });
    else await navigator.clipboard?.writeText(url);
  };

  return (
    <main className="metro-app">
      <header className="app-header">
        <button className="brand" onClick={() => setView("schedule")} aria-label="Метро Київ, головна">
          <MetroMark /><span><b>Метро Київ</b><small>графік руху</small></span>
        </button>
        <div className="live-clock"><i />{kyivFormatter.format(now)}</div>
      </header>

      {view === "schedule" && (
        <section className="schedule-view">
          <div className="welcome-strip"><span>✦</span><p>Розрахунковий час базується на офіційних інтервалах руху. Перед поїздкою перевіряйте оперативні зміни.</p></div>
          <div className="hero-copy">
            <h1>Ваш маршрут метро</h1>
            <p>Вкажіть початок і кінець поїздки — побачите напрямок, час у дорозі та відлік до наступного поїзда.</p>
          </div>
          <section className="journey-panel" aria-label="Побудова маршруту метро">
            <StationPicker stationId={stationId} onChange={setStationId} label="Звідки" />
            <button className="swap-stations" onClick={swapStations} aria-label="Поміняти станції місцями">⇄</button>
            <StationPicker stationId={toId} onChange={setToId} label="Куди" />
            <div className="journey-result">
              <span>Маршрут</span>
              {stationId === toId ? <b>Ви вже на станції «{station.name}»</b> : <b>≈ {tripMinutes} хв · {route.length - 1} станцій{transfers ? ` · ${transfers} пересадка` : " · без пересадок"}</b>}
            </div>
          </section>
          <div className={`directions ${showBoth ? "directions--both" : ""}`}>
            {predictions.map((_, index) => (showBoth || index === direction) && <DirectionCard key={index} station={station} directionIndex={index} active={direction === index} now={now} day={day} onClick={() => setDirection(index)} />)}
          </div>
          <section className="timer-board">
            <p>До відправлення наступного поїзда</p>
            <strong>{formatTimer(activePrediction.seconds)}</strong>
            <span>{station.name} → {activePrediction.direction} · {activePrediction.clockTime}</span>
            <div className="timer-board__journey">{recommendedDirection ? <>Щоб доїхати до <b>{destination.name}</b>, сідайте у напрямку <b>«{recommendedDirection}»</b>.</> : stationId === toId ? "Оберіть іншу станцію призначення." : `До ${destination.name}: ≈ ${tripMinutes} хв.`}</div>
            <div className="timer-board__details"><span>{LINE_META[station.line].code} · {LINE_META[station.line].name}</span><span>{interval.label}</span></div>
          </section>
          <div className="day-toggle" role="group" aria-label="Тип дня">
            <button className={day === "weekday" ? "is-active" : ""} onClick={() => setDay("weekday")}>📅 Будні</button>
            <button className={day === "weekend" ? "is-active" : ""} onClick={() => setDay("weekend")}>☾ Вихідні</button>
          </div>
          <section className="next-trains">
            <header><div><p className="eyebrow">Графік на день</p><h2>Наступні відправлення</h2></div><button onClick={shareStation}>Поділитися</button></header>
            <div className="time-grid">{schedule.map((time, index) => <span className={index === 0 ? "is-next" : ""} key={`${time}-${index}`}>{time}{index === 0 && <small>далі</small>}</span>)}</div>
            <p className="fine-print">Часи сформовані за діючими інтервалами для обраного типу дня; вони не є диспетчерським live-розкладом.</p>
          </section>
          <section className="station-meta">
            <div><span>◷</span><p>Режим роботи</p><b>орієнтовно 05:30 — 23:00</b></div>
            <div><span>★</span><p>Обране</p><button onClick={toggleFavorite} aria-pressed={favorite}>{favorite ? "Збережено" : "Зберегти станцію"}</button></div>
          </section>
        </section>
      )}

      {view === "map" && <MetroMap />}

      {view === "about" && <section className="info-page"><p className="eyebrow">Про застосунок</p><h1>Метро Київ — простий спосіб звірити час.</h1><div className="info-card"><h2>Джерело даних</h2><p>Станції, напрямки, режим роботи та інтервали руху отримані з відкритих даних Києва. Інформація завантажується в застосунок і доступна офлайн.</p></div><div className="info-card"><h2>Як працює таймер</h2><p>Це розрахунок до наступного відправлення, який оновлюється щосекунди. Він враховує лінію, напрямок, тип дня та офіційні погодинні інтервали, але не відстежує фактичне положення поїзда.</p></div><div className="info-card warning"><h2>Важливо</h2><p>Під час повітряної тривоги або змін у роботі метро рух може відрізнятися від розрахунку. Орієнтуйтеся на оголошення Київського метрополітену.</p></div></section>}

      {view === "settings" && <section className="settings-page"><p className="eyebrow">Налаштування</p><h1>Підлаштуйте під себе</h1><div className="setting-group"><h2>Тема оформлення</h2><div className="theme-options">{(["light", "dark", "system"] as Theme[]).map((option) => <button className={theme === option ? "is-active" : ""} onClick={() => setTheme(option)} key={option}>{option === "light" ? "☀️ Світла" : option === "dark" ? "☾ Темна" : "◐ Системна"}</button>)}</div></div><div className="setting-row"><div><h2>Таймери в обох напрямках</h2><p>Показувати обидва напрямки на головному екрані одразу.</p></div><button className={`switch ${showBoth ? "is-on" : ""}`} onClick={() => setShowBoth((value) => !value)} aria-pressed={showBoth}><i /></button></div><div className="setting-row"><div><h2>Обрані станції</h2><p>{favorites.length ? favorites.map((id) => STATION_BY_ID[id]?.name).join(", ") : "Ще немає збережених станцій."}</p></div><button onClick={() => setFavorites([])} disabled={!favorites.length}>Очистити</button></div><p className="fine-print">Налаштування зберігаються тільки на цьому пристрої.</p></section>}

      <nav className="bottom-nav" aria-label="Навігація">
        <button className={view === "schedule" ? "is-active" : ""} onClick={() => setView("schedule")}><span>⌁</span>Маршрут</button>
        <button className={view === "map" ? "is-active" : ""} onClick={() => setView("map")}><span>▣</span>Карта</button>
        <button className={view === "about" ? "is-active" : ""} onClick={() => setView("about")}><span>◌</span>Довідка</button>
        <button className={view === "settings" ? "is-active" : ""} onClick={() => setView("settings")}><span>≡</span>Ще</button>
      </nav>
    </main>
  );
}
