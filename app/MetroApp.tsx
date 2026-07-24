"use client";

import {
  Suspense,
  lazy,
  useEffect,
  useMemo,
} from "react";
import {
  STATION_BY_ID,
  estimateTripMinutes,
  getRoute,
  routeTransfers,
} from "./metro-data";
import {
  DESKTOP_NAV,
  MOBILE_NAV,
} from "./app-types";
import MetroTripAssistant from "./components/MetroTripAssistant";
import StationSheet from "./components/StationSheet";
import { useMetroNavigation } from "./hooks/useMetroNavigation";
import { useNearestStation } from "./hooks/useNearestStation";
import { useOfficialMetroCoordinates } from "./hooks/useOfficialMetroCoordinates";
import { useMetroPreferences } from "./hooks/useMetroPreferences";
import { usePwaInstall } from "./hooks/usePwaInstall";
import { useShareRoute } from "./hooks/useShareRoute";
import { useToast } from "./hooks/useToast";
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
    savedRoutes,
    setSavedRoutes,
    recentRoutes,
    rememberRoute,
  } = useMetroPreferences();
  const { toast, showToast } = useToast();
  const { triggerInstall } = usePwaInstall(showToast);
  const {
    coordinates: liveCoords,
    status: coordinateStatus,
    officialCoordinateCount,
  } = useOfficialMetroCoordinates();

  const route = useMemo(() => getRoute(from, to), [from, to]);
  const transfers = routeTransfers(route);
  const tripMinutes = estimateTripMinutes(route);
  const { geoStatus, findNearest } = useNearestStation({
    officialCoordinates: liveCoords,
    onFromChange: setFrom,
    showToast,
  });
  const { shareRoute } = useShareRoute({
    from,
    to,
    tripMinutes,
    showToast,
  });

  const toggleFavorite = (id: string) => {
    setFavorites((current) =>
      current.includes(id)
        ? current.filter((stationId) => stationId !== id)
        : [...current, id],
    );
  };

  useEffect(() => {
    rememberRoute(from, to);
  }, [from, rememberRoute, to]);

  const routeSaved = savedRoutes.some(
    (savedRoute) => savedRoute.from === from && savedRoute.to === to,
  );

  const toggleSavedRoute = () => {
    if (routeSaved) {
      setSavedRoutes((current) =>
        current.filter(
          (savedRoute) => savedRoute.from !== from || savedRoute.to !== to,
        ),
      );
      showToast("Маршрут прибрано зі збережених");
      return;
    }
    setSavedRoutes((current) => [
      { from, to, usedAt: Date.now() },
      ...current.filter(
        (savedRoute) => savedRoute.from !== from || savedRoute.to !== to,
      ),
    ].slice(0, 8));
    showToast("Маршрут збережено офлайн");
  };

  const openJourney = (journeyFrom: string, journeyTo: string) => {
    setFrom(journeyFrom);
    setTo(journeyTo);
    rememberRoute(journeyFrom, journeyTo);
    chooseView("planner");
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
          <MetroTripAssistant
            compact
            route={route}
            tripMinutes={tripMinutes}
            onOpen={() => chooseView("planner")}
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
          saved={routeSaved}
          geoStatus={geoStatus}
          onFromChange={setFrom}
          onToChange={setTo}
          onSwap={swap}
          onFindNearest={findNearest}
          onOpenMap={() => chooseView("map")}
          onShare={shareRoute}
          onSave={toggleSavedRoute}
          onStation={openStation}
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
          savedRoutes={savedRoutes}
          recentRoutes={recentRoutes}
          onStation={openStation}
          onFavorite={toggleFavorite}
          onJourney={openJourney}
          onRemoveSaved={(savedFrom, savedTo) => {
            setSavedRoutes((current) =>
              current.filter(
                (savedRoute) =>
                  savedRoute.from !== savedFrom || savedRoute.to !== savedTo,
              ),
            );
            showToast("Маршрут прибрано зі збережених");
          }}
        />
      )}
      {view === "settings" && (
        <SettingsView
          theme={theme}
          coordinateStatus={coordinateStatus}
          officialCoordinateCount={officialCoordinateCount}
          onThemeChange={setTheme}
          onInstall={triggerInstall}
        />
      )}
      {activeStation && (
        <StationSheet
          key={activeStation}
          station={STATION_BY_ID[activeStation]}
          favorite={favorites.includes(activeStation)}
          onFavorite={() => toggleFavorite(activeStation)}
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
