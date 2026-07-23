"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  LINE_META,
  OFFICIAL_GEOJSON_URL,
  STATION_BY_ID,
  STATIONS,
  estimateTripMinutes,
  getRoute,
  getStationPredictions,
  routeTransfers,
  type LineId,
} from "./metro-data";
import CityTransit from "./CityTransit";
import MetroMap from "./components/MetroMap";
import OfficialMapViewer from "./components/OfficialMapViewer";
import {
  RouteItinerary,
  RouteJourney,
} from "./components/RouteDetails";
import StationSelect from "./components/StationSelect";
import StationSheet from "./components/StationSheet";
import TrackedStation from "./components/TrackedStation";
import { formatTimer } from "./components/station-time";

type Theme = "system" | "light" | "dark";
type View = "planner" | "city" | "map" | "stations" | "settings";
type LineFilter = "all" | LineId | "favorites";

const STORAGE = {
  favorites: "metro-kyiv:favorites",
  theme: "metro-kyiv:theme",
  timerStation: "metro-kyiv:timer-station",
};

const LINE_IDS: LineId[] = ["red", "blue", "green"];
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
          <small>увесь транспорт міста</small>
        </span>
      )}
    </span>
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
    if (
      queryView &&
      ["planner", "city", "map", "stations", "settings"].includes(queryView)
    ) {
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
        return response.json() as Promise<{
          features?: Array<{
            properties?: Record<string, unknown>;
            geometry?: { coordinates?: unknown };
          }>;
        }>;
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
    <main className={`app-shell ${view === "city" ? "app-shell--city" : ""}`}>
      <header className="topbar">
        <MetroLogo />
        <nav className="desktop-nav" aria-label="Головна навігація">
          {(
            [
              ["planner", "Маршрут"],
              ["city", "Увесь транспорт"],
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
            aria-label={`${LINE_META[STATION_BY_ID[timerStation].line].code} · ${
              STATION_BY_ID[timerStation].name
            } ${formatTimer(quickTimerSeconds)}`}
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

      {view === "city" && (
        <CityTransit
          showToast={showToast}
          onBackToMetro={() => chooseView("planner")}
        />
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
            <h2>Наземний транспорт і сповіщення</h2>
            <p>
              158 маршрутів і 1447 зупинок зібрано з офіційного GTFS Static
              Київпастрансу. Живі позиції надходять із GTFS Realtime та
              оновлюються кожні 30 секунд.
            </p>
            <p>
              Транспортні зміни беруться з офіційного каналу КМДА. Фонові
              перевірки доступні після встановлення PWA у браузерах, що
              підтримують Periodic Background Sync.
            </p>
            <div className="source-list">
              <a
                href="https://data.kyivcity.gov.ua/dataset/rozklad-rukhu-miskoho-elektrychnoho-ta-avtomobilnoho-transportu-dep-transport"
                target="_blank"
                rel="noreferrer"
              >
                GTFS і розклади Києва ↗
              </a>
              <a
                href="https://data.kyivcity.gov.ua/dataset/dani-pro-mistseznakhodzhennia-miskoho-elektrychnoho-ta-pasazhyrskoho-avtomobilnoho-tra-dep-transport"
                target="_blank"
                rel="noreferrer"
              >
                Транспорт наживо ↗
              </a>
              <a href="https://t.me/KyivCityOfficial" target="_blank" rel="noreferrer">
                Офіційний канал КМДА ↗
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
            ["city", "≋", "Транспорт"],
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
