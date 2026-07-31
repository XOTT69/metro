import { useEffect, useState } from "react";
import {
  LINE_META,
  LINE_STATIONS,
  STATION_BY_ID,
  getServiceInterval,
  getStationPredictions,
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
}: {
  stationId: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="station-picker">
      <span>Станція</span>
      <select value={stationId} onChange={(event) => onChange(event.target.value)}>
        {lineIds.map((line) => (
          <optgroup key={line} label={`${LINE_META[line].code} · ${LINE_META[line].name}`}>
            {LINE_STATIONS[line].map((station) => (
              <option key={station.id} value={station.id}>{station.name}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
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

function MetroMap({ stationId, onStation }: { stationId: string; onStation: (id: string) => void }) {
  return (
    <section className="map-panel" aria-label="Схема київського метро">
      <div className="map-panel__heading">
        <p className="eyebrow">Навігація</p>
        <h1>Схема метро</h1>
        <span>Натисніть станцію, щоб відкрити таймер</span>
      </div>
      <div className="line-map">
        {lineIds.map((line) => (
          <article className={`map-line map-line--${line}`} key={line}>
            <header>
              <i style={{ backgroundColor: LINE_META[line].color }} />
              <b>{LINE_META[line].code}</b>
              <span>{LINE_META[line].name}</span>
            </header>
            <div className="station-rail" style={{ "--line-color": LINE_META[line].color } as React.CSSProperties}>
              {LINE_STATIONS[line].map((station) => (
                <button
                  key={station.id}
                  className={station.id === stationId ? "is-selected" : ""}
                  onClick={() => onStation(station.id)}
                >
                  <i />
                  <span>{station.name}</span>
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
      <p className="map-note">Пересадки: Хрещатик — Майдан Незалежності, Театральна — Золоті ворота, Площа Українських Героїв — Палац спорту.</p>
    </section>
  );
}

export default function MetroApp() {
  const [view, setView] = useState<View>("schedule");
  const [now, setNow] = useState(() => new Date());
  const [stationId, setStationId] = useState("khreshchatyk");
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

  const openStation = (id: string) => {
    setStationId(id);
    setView("schedule");
    window.scrollTo({ top: 0, behavior: "smooth" });
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
            <p className="eyebrow">Метро без зайвого</p>
            <h1>Коли буде наступний поїзд?</h1>
            <p>Оберіть станцію — таймер покаже час в обох напрямках до секунди.</p>
          </div>
          <StationPicker stationId={stationId} onChange={setStationId} />
          <div className={`directions ${showBoth ? "directions--both" : ""}`}>
            {predictions.map((_, index) => (showBoth || index === direction) && <DirectionCard key={index} station={station} directionIndex={index} active={direction === index} now={now} day={day} onClick={() => setDirection(index)} />)}
          </div>
          <section className="timer-board">
            <p>До відправлення наступного поїзда</p>
            <strong>{formatTimer(activePrediction.seconds)}</strong>
            <span>напрямок «{activePrediction.direction}» · {activePrediction.clockTime}</span>
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

      {view === "map" && <MetroMap stationId={stationId} onStation={openStation} />}

      {view === "about" && <section className="info-page"><p className="eyebrow">Про застосунок</p><h1>Метро Київ — простий спосіб звірити час.</h1><div className="info-card"><h2>Джерело даних</h2><p>Станції, напрямки, режим роботи та інтервали руху отримані з відкритих даних Києва. Інформація завантажується в застосунок і доступна офлайн.</p></div><div className="info-card"><h2>Як працює таймер</h2><p>Це розрахунок до наступного відправлення, який оновлюється щосекунди. Він враховує лінію, напрямок, тип дня та офіційні погодинні інтервали, але не відстежує фактичне положення поїзда.</p></div><div className="info-card warning"><h2>Важливо</h2><p>Під час повітряної тривоги або змін у роботі метро рух може відрізнятися від розрахунку. Орієнтуйтеся на оголошення Київського метрополітену.</p></div></section>}

      {view === "settings" && <section className="settings-page"><p className="eyebrow">Налаштування</p><h1>Підлаштуйте під себе</h1><div className="setting-group"><h2>Тема оформлення</h2><div className="theme-options">{(["light", "dark", "system"] as Theme[]).map((option) => <button className={theme === option ? "is-active" : ""} onClick={() => setTheme(option)} key={option}>{option === "light" ? "☀️ Світла" : option === "dark" ? "☾ Темна" : "◐ Системна"}</button>)}</div></div><div className="setting-row"><div><h2>Таймери в обох напрямках</h2><p>Показувати обидва напрямки на головному екрані одразу.</p></div><button className={`switch ${showBoth ? "is-on" : ""}`} onClick={() => setShowBoth((value) => !value)} aria-pressed={showBoth}><i /></button></div><div className="setting-row"><div><h2>Обрані станції</h2><p>{favorites.length ? favorites.map((id) => STATION_BY_ID[id]?.name).join(", ") : "Ще немає збережених станцій."}</p></div><button onClick={() => setFavorites([])} disabled={!favorites.length}>Очистити</button></div><p className="fine-print">Налаштування зберігаються тільки на цьому пристрої.</p></section>}

      <nav className="bottom-nav" aria-label="Навігація">
        <button className={view === "schedule" ? "is-active" : ""} onClick={() => setView("schedule")}><span>◷</span>Графік</button>
        <button className={view === "map" ? "is-active" : ""} onClick={() => setView("map")}><span>⌁</span>Схема</button>
        <button className={view === "about" ? "is-active" : ""} onClick={() => setView("about")}><span>i</span>Про проєкт</button>
        <button className={view === "settings" ? "is-active" : ""} onClick={() => setView("settings")}><span>⚙</span>Налаштування</button>
      </nav>
    </main>
  );
}
