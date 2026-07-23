"use client";

import {
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  OFFICIAL_GEOJSON_URL,
  STATION_BY_ID,
  STATIONS,
  estimateTripMinutes,
  getRoute,
  routeTransfers,
} from "./metro-data";
import {
  DESKTOP_NAV,
  MOBILE_NAV,
  type GeoStatus,
} from "./app-types";
import QuickTimer from "./components/QuickTimer";
import StationSheet from "./components/StationSheet";
import { useMetroNavigation } from "./hooks/useMetroNavigation";
import { useMetroPreferences } from "./hooks/useMetroPreferences";
import { normalizeStationName } from "./station-search";
import MapView from "./views/MapView";
import PlannerView from "./views/PlannerView";
import SettingsView from "./views/SettingsView";
import StationsView from "./views/StationsView";

const CityTransit = lazy(() => import("./CityTransit"));

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
  const {
    from,
    to,
    view,
    activeStation,
    setFrom,
    setTo,
    swap,
    chooseView,
    openStation,
    closeStation,
  } = useMetroNavigation();
  const {
    theme,
    setTheme,
    favorites,
    setFavorites,
    timerStation,
    setTimerStation,
  } = useMetroPreferences();
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const [liveCoords, setLiveCoords] = useState<Record<string, [number, number]>>({});
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
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
          STATIONS.map((station) => [normalizeStationName(station.name), station]),
        );
        for (const feature of data.features || []) {
          const rawName =
            feature.properties?.name ||
            feature.properties?.NAME ||
            feature.properties?.station_name ||
            "";
          const station = stationsByName.get(normalizeStationName(String(rawName)));
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

  const route = useMemo(() => getRoute(from, to), [from, to]);
  const transfers = routeTransfers(route);
  const tripMinutes = estimateTripMinutes(route);

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

  const trackStation = (id: string) => {
    setTimerStation(id);
    showToast(`Таймер: ${STATION_BY_ID[id].name}`);
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
          {DESKTOP_NAV.map(([id, label]) => (
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
          <QuickTimer
            station={STATION_BY_ID[timerStation]}
            onOpen={() => openStation(timerStation)}
          />
          <button className="install-button" onClick={triggerInstall}>
            Встановити
          </button>
        </div>
      </header>

      {view === "planner" && (
        <PlannerView
          from={from}
          to={to}
          route={route}
          tripMinutes={tripMinutes}
          transfers={transfers}
          timerStation={timerStation}
          geoStatus={geoStatus}
          onFromChange={setFrom}
          onToChange={setTo}
          onSwap={swap}
          onFindNearest={findNearest}
          onOpenMap={() => chooseView("map")}
          onShare={shareRoute}
          onStation={openStation}
          onTrack={trackStation}
        />
      )}
      {view === "map" && (
        <MapView
          from={from}
          to={to}
          route={route}
          tripMinutes={tripMinutes}
          transfers={transfers}
          onFromChange={setFrom}
          onToChange={setTo}
          onSwap={swap}
          onBack={() => chooseView("planner")}
          onStation={openStation}
        />
      )}
      {view === "city" && (
        <Suspense
          fallback={
            <div className="empty-state" role="status">
              Завантажуємо карту транспорту…
            </div>
          }
        >
          <CityTransit
            showToast={showToast}
            onBackToMetro={() => chooseView("planner")}
          />
        </Suspense>
      )}

      {view === "stations" && (
        <StationsView
          favorites={favorites}
          timerStation={timerStation}
          onStation={openStation}
          onTrack={trackStation}
          onFavorite={toggleFavorite}
        />
      )}
      {view === "settings" && (
        <SettingsView
          theme={theme}
          onThemeChange={setTheme}
          onInstall={triggerInstall}
        />
      )}
      {activeStation && (
        <StationSheet
          key={activeStation}
          station={STATION_BY_ID[activeStation]}
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
        {MOBILE_NAV.map(([id, icon, label]) => (
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
