"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import TransitMap from "./TransitMap";
import { type LineId } from "./metro-data";
import {
  type TransitCoordinate,
  type TransitRouteProfile,
} from "./transit-router";
import TransitAlertsPanel from "./city-transit/TransitAlertsPanel";
import TransitCatalogPanel from "./city-transit/TransitCatalogPanel";
import TransitPlanPanel from "./city-transit/TransitPlanPanel";
import ActiveJourneyPanel from "./city-transit/ActiveJourneyPanel";
import TransitFloatingControls from "./city-transit/TransitFloatingControls";
import {
  TransitRouteDetails,
  TransitStopDetails,
} from "./city-transit/TransitDetailsPanel";
import { useLiveVehicles } from "./city-transit/hooks/useLiveVehicles";
import { useTransitNetwork } from "./city-transit/hooks/useTransitNetwork";
import { useTransportAlerts } from "./city-transit/hooks/useTransportAlerts";
import { useTransitPlanner } from "./city-transit/hooks/useTransitPlanner";
import {
  isInsideKyiv,
  type CatalogMode,
  type PanelTab,
} from "./city-transit/model";
import {
  filterVisibleVehicles,
  getVisibleVehicleRouteIds,
} from "./city-transit/vehicle-visibility";
import "./city-transit.css";

export default function CityTransit({
  showToast,
  onBackToMetro,
}: {
  showToast: (message: string) => void;
  onBackToMetro: () => void;
}) {
  const { data, loadError } = useTransitNetwork();
  const { vehicles, liveUpdatedAt, liveError } = useLiveVehicles();
  const { alerts, alertsError } = useTransportAlerts();
  const [fromPoint, setFromPoint] = useState<TransitCoordinate | null>(null);
  const [toPoint, setToPoint] = useState<TransitCoordinate | null>(null);
  const [mapPointTarget, setMapPointTarget] = useState<"from" | "to">("from");
  const [pickingPoint, setPickingPoint] = useState(false);
  const [activePlanIndex, setActivePlanIndex] = useState(0);
  const [journeyActive, setJourneyActive] = useState(false);
  const [journeyLegIndex, setJourneyLegIndex] = useState(0);
  const [journeyStartedAt, setJourneyStartedAt] = useState(0);
  const [panelTab, setPanelTab] = useState<PanelTab>("plan");
  const [panelOpen, setPanelOpen] = useState(
    () => window.matchMedia("(min-width: 900px)").matches,
  );
  const [searchExpanded, setSearchExpanded] = useState(
    () => window.matchMedia("(min-width: 900px)").matches,
  );
  const [routeMode, setRouteMode] = useState<CatalogMode>("all");
  const [routeProfile, setRouteProfile] = useState<TransitRouteProfile>(() => {
    const saved = localStorage.getItem("metro-kyiv:route-profile");
    return saved === "fewest-transfers" ||
      saved === "less-walking" ||
      saved === "favorites"
      ? saved
      : "fastest";
  });
  const [routeQuery, setRouteQuery] = useState("");
  const [journeyTimeMode, setJourneyTimeMode] = useState<"depart" | "arrive">("depart");
  const [journeyTime, setJourneyTime] = useState(() =>
    new Date().toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" }),
  );
  const [selectedRoute, setSelectedRoute] = useState<number | null>(null);
  const [selectedStop, setSelectedStop] = useState<number | null>(null);
  const [selectedMetroLine, setSelectedMetroLine] = useState<LineId | null>(null);
  const [alertsEnabled, setAlertsEnabled] = useState(
    () => localStorage.getItem("metro-kyiv:transport-alerts") === "on",
  );
  const [favoriteRoutes, setFavoriteRoutes] = useState<string[]>(() => {
    try {
      return JSON.parse(
        localStorage.getItem("metro-kyiv:favorite-routes") || "[]",
      );
    } catch {
      return [];
    }
  });

  const regionRouteRequested = Boolean(
    fromPoint &&
      toPoint &&
      (!isInsideKyiv(fromPoint) || !isInsideKyiv(toPoint)),
  );
  const selectedMinute = useMemo(() => {
    const [hours, minutes] = journeyTime.split(":").map(Number);
    return Number.isFinite(hours) && Number.isFinite(minutes)
      ? hours * 60 + minutes
      : new Date().getHours() * 60 + new Date().getMinutes();
  }, [journeyTime]);
  const { plans, planning } = useTransitPlanner({
    data,
    from: fromPoint,
    to: toPoint,
    profile: routeProfile,
    favoriteRoutes,
    departureMinute: journeyTimeMode === "depart" ? selectedMinute : undefined,
    arrivalMinute: journeyTimeMode === "arrive" ? selectedMinute : undefined,
  });
  const activePlan = plans[activePlanIndex] || plans[0] || null;

  useEffect(() => {
    setActivePlanIndex(0);
    setJourneyActive(false);
    setJourneyLegIndex(0);
    setSelectedRoute(null);
    setSelectedMetroLine(null);
  }, [fromPoint, routeProfile, toPoint]);

  const startJourney = () => {
    if (!activePlan) return;
    setJourneyActive(true);
    setJourneyLegIndex(0);
    setJourneyStartedAt(Date.now());
    if (window.matchMedia("(max-width: 899px)").matches) setPanelOpen(false);
    showToast("Поїздку розпочато");
  };

  const chooseRouteProfile = (profile: TransitRouteProfile) => {
    setRouteProfile(profile);
    localStorage.setItem("metro-kyiv:route-profile", profile);
  };

  useEffect(() => {
    const closePanel = (event: KeyboardEvent) => {
      if (event.key === "Escape" && panelOpen && !pickingPoint) {
        setPanelOpen(false);
      }
    };
    window.addEventListener("keydown", closePanel);
    return () => window.removeEventListener("keydown", closePanel);
  }, [panelOpen, pickingPoint]);

  const routeList = useMemo(() => {
    if (!data) return [];
    const collator = new Intl.Collator("uk", { numeric: true });
    const query = routeQuery.toLocaleLowerCase("uk-UA").trim();
    return data.routes
      .map((route, index) => ({ route, index }))
      .filter(({ route }) => {
        if (routeMode === "favorites") {
          return favoriteRoutes.includes(route[0]);
        }
        if (routeMode === "metro") return false;
        return routeMode === "all" || route[3] === routeMode;
      })
      .filter(({ route }) =>
        `${route[1]} ${route[2]}`.toLocaleLowerCase("uk-UA").includes(query),
      )
      .sort((a, b) => {
        const favoriteDifference =
          Number(favoriteRoutes.includes(b.route[0])) -
          Number(favoriteRoutes.includes(a.route[0]));
        return favoriteDifference || collator.compare(a.route[1], b.route[1]);
      });
  }, [data, favoriteRoutes, routeMode, routeQuery]);

  const selectedRouteMeta =
    selectedRoute !== null && data ? data.routes[selectedRoute] : null;
  const selectedRouteVehicles = selectedRouteMeta
    ? vehicles.filter((vehicle) => vehicle.routeId === selectedRouteMeta[0])
    : [];
  const visibleVehicleRouteIds = useMemo(
    () =>
      getVisibleVehicleRouteIds({
        favoriteRouteIds: favoriteRoutes,
        selectedRouteId: selectedRouteMeta?.[0] || null,
        activePlan: panelTab === "plan" ? activePlan : null,
      }),
    [activePlan, favoriteRoutes, panelTab, selectedRouteMeta],
  );
  const visibleVehicleCount = useMemo(
    () => filterVisibleVehicles(vehicles, visibleVehicleRouteIds).length,
    [vehicles, visibleVehicleRouteIds],
  );

  const counts = useMemo(() => {
    const result = { bus: 0, trolleybus: 0, tram: 0, minibus: 0 };
    if (!data) return result;
    data.routes.forEach((route) => {
      if (route[3] === "bus") result.bus += 1;
      if (route[3] === "trolleybus") result.trolleybus += 1;
      if (route[3] === "tram") result.tram += 1;
      if (route[3] === "minibus") result.minibus += 1;
    });
    return result;
  }, [data]);

  const openPanel = (tab: PanelTab) => {
    setPanelTab(tab);
    setPanelOpen(true);
  };

  const locate = () => {
    if (!navigator.geolocation) {
      showToast("Геолокація недоступна");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setFromPoint({
          id: `geo:${coords.latitude.toFixed(5)}:${coords.longitude.toFixed(5)}`,
          name: "Моя геопозиція",
          detail: "Поточне місце",
          lat: coords.latitude,
          lon: coords.longitude,
        });
        setMapPointTarget("to");
        setSearchExpanded(true);
        openPanel("plan");
        showToast("Точку А встановлено");
      },
      () => showToast("Не вдалося отримати геопозицію"),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const startPicking = (target: "from" | "to") => {
    setMapPointTarget(target);
    setPickingPoint(true);
    setPanelOpen(false);
    showToast(`Торкніться карти для точки ${target === "from" ? "А" : "Б"}`);
  };

  const selectMapPoint = (latitude: number, longitude: number) => {
    if (!pickingPoint) return;
    const point: TransitCoordinate = {
      id: `map:${latitude.toFixed(5)}:${longitude.toFixed(5)}`,
      name: "Точка на карті",
      detail: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      lat: latitude,
      lon: longitude,
    };
    if (mapPointTarget === "from") {
      setFromPoint(point);
      setMapPointTarget("to");
      showToast("Точку А встановлено");
    } else {
      setToPoint(point);
      setMapPointTarget("from");
      showToast("Точку Б встановлено");
    }
    setPickingPoint(false);
    setSearchExpanded(true);
    openPanel("plan");
  };

  const chooseRoute = (index: number) => {
    setSelectedRoute(index);
    setSelectedStop(null);
    setSelectedMetroLine(null);
    setPanelTab("catalog");
    setPanelOpen(true);
  };

  const chooseStop = (index: number) => {
    setSelectedStop(index);
    setPanelTab("catalog");
    setPanelOpen(true);
  };

  const chooseMetroLine = (line: LineId) => {
    setSelectedMetroLine(line);
    setSelectedRoute(null);
    if (window.matchMedia("(max-width: 899px)").matches) setPanelOpen(false);
  };

  const toggleFavoriteRoute = (routeId: string) => {
    const next = favoriteRoutes.includes(routeId)
      ? favoriteRoutes.filter((id) => id !== routeId)
      : [...favoriteRoutes, routeId];
    setFavoriteRoutes(next);
    localStorage.setItem("metro-kyiv:favorite-routes", JSON.stringify(next));
    const routeNumbers = data?.routes
      .filter((route) => next.includes(route[0]))
      .map((route) => route[1]) || [];
    navigator.serviceWorker?.ready.then((registration) =>
      registration.active?.postMessage({
        type: "transport-alert-preferences",
        routes: routeNumbers,
      }),
    );
  };

  const enableAlerts = async () => {
    if (!("Notification" in window)) {
      showToast("Цей браузер не підтримує сповіщення");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      showToast("Дозвіл на сповіщення не надано");
      return;
    }
    localStorage.setItem("metro-kyiv:transport-alerts", "on");
    setAlertsEnabled(true);
    const registration = await navigator.serviceWorker?.ready;
    registration?.active?.postMessage({
      type: "transport-alert-preferences",
      routes: data?.routes
        .filter((route) => favoriteRoutes.includes(route[0]))
        .map((route) => route[1]) || [],
    });
    const periodicSync = registration &&
      (registration as ServiceWorkerRegistration & {
        periodicSync?: { register: (tag: string, options: { minInterval: number }) => Promise<void> };
      }).periodicSync;
    await periodicSync
      ?.register("transport-alerts", { minInterval: 60 * 60 * 1000 })
      .catch(() => undefined);
    showToast("Сповіщення увімкнено");
  };

  if (loadError) {
    return (
      <section className="transport-hub-fallback">
        <button type="button" onClick={onBackToMetro}>← До метро</button>
        <p>Не вдалося завантажити транспортну мережу. Метро працює офлайн.</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="transport-hub-loading">
        <span />
        Готуємо транспортну карту…
      </section>
    );
  }

  return (
    <section className="transport-hub-shell">
      <TransitMap
        data={data}
        vehicles={vehicles}
        activePlan={panelTab === "plan" ? activePlan : null}
        selectedRoute={selectedRoute}
        selectedMetroLine={selectedMetroLine}
        favoriteRouteIds={favoriteRoutes}
        panelOpen={panelOpen}
        onLocate={locate}
        onMapPoint={selectMapPoint}
        showRegion={regionRouteRequested}
        pickingPoint={pickingPoint}
        onStop={chooseStop}
      />

      <header className={`transport-hub-search ${searchExpanded ? "is-expanded" : ""}`}>
        <button
          type="button"
          className="transport-back"
          onClick={onBackToMetro}
          aria-label="Повернутися до метро"
        >
          <span aria-hidden="true">←</span>
          <img src="/metro-logo.svg" alt="" />
        </button>
        {!searchExpanded ? (
          <button
            type="button"
            className="transport-search-prompt"
            onClick={() => {
              setSearchExpanded(true);
              openPanel("plan");
            }}
          >
            <span>⌕</span>
            <span>
              <strong>Куди прямуєте?</strong>
              <small>Адреси Києва та області</small>
            </span>
          </button>
        ) : (
          <div className="transport-mobile-address-summary">
            <button type="button" onClick={() => openPanel("plan")}>
              <span className="is-a">А</span>
              <strong>{fromPoint?.name || "Звідки"}</strong>
            </button>
            <button type="button" onClick={() => openPanel("plan")}>
              <span className="is-b">Б</span>
              <strong>{toPoint?.name || "Куди"}</strong>
            </button>
          </div>
        )}
        <div className={`transport-live-status ${liveError ? "is-error" : ""}`}>
          <i />
          <span>{liveError ? "без live" : `${visibleVehicleCount} на карті`}</span>
        </div>
      </header>

      <aside
        className={`transport-hub-panel ${panelOpen ? "is-open" : "is-closed"}`}
        aria-hidden={!panelOpen}
        inert={!panelOpen}
      >
        <div className="transport-panel-brand">
          <button type="button" onClick={onBackToMetro}>
            <span className="transport-panel-back" aria-hidden="true">←</span>
            <img src="/metro-logo.svg" alt="" />
            <span>
              <strong>Metro Kyiv</strong>
              <small>Назад до метро</small>
            </span>
          </button>
          <div className="transport-panel-meta">
            <div className={`transport-live-status ${liveError ? "is-error" : ""}`}>
              <i />
              <span>
                {liveError
                  ? "Live недоступний"
                  : `${visibleVehicleCount} показано${
                      liveUpdatedAt
                        ? ` · ${liveUpdatedAt.toLocaleTimeString("uk-UA", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`
                        : ""
                    }`}
              </span>
            </div>
            <button
              type="button"
              className="transport-panel-collapse"
              onClick={() => setPanelOpen(false)}
              aria-label="Сховати панель і відкрити карту"
              title="Показати карту"
            >
              <span aria-hidden="true">‹</span>
              Карта
            </button>
          </div>
        </div>

        <button
          type="button"
          className="transport-sheet-handle"
          onClick={() => setPanelOpen(false)}
          aria-label="Показати карту"
        >
          <span aria-hidden="true" />
          <strong>Показати карту</strong>
          <i aria-hidden="true">⌄</i>
        </button>

        <div className="transport-panel-tabs" role="tablist">
          {(
            [
              ["plan", "Маршрут"],
              ["catalog", "Транспорт"],
              ["alerts", "Зміни"],
            ] as const
          ).map(([tab, label]) => (
            <button
              type="button"
              role="tab"
              aria-selected={panelTab === tab}
              className={panelTab === tab ? "is-active" : ""}
              onClick={() => setPanelTab(tab)}
              key={tab}
            >
              {label}
              {tab === "alerts" && alerts.length > 0 && <i>{alerts.length}</i>}
            </button>
          ))}
        </div>

        <div className="transport-panel-scroll">
          {panelTab === "plan" && (
            journeyActive && activePlan ? (
              <ActiveJourneyPanel
                plan={activePlan}
                legIndex={journeyLegIndex}
                startedAt={journeyStartedAt}
                onAdvance={() =>
                  setJourneyLegIndex((index) =>
                    Math.min(index + 1, activePlan.legs.length - 1),
                  )
                }
                onShowMap={() => setPanelOpen(false)}
                onFinish={() => {
                  setJourneyActive(false);
                  setJourneyLegIndex(0);
                  showToast("Поїздку завершено");
                }}
              />
            ) : (
            <TransitPlanPanel
              fromPoint={fromPoint}
              toPoint={toPoint}
              regionRouteRequested={regionRouteRequested}
              planning={planning}
              journeyTimeMode={journeyTimeMode}
              journeyTime={journeyTime}
              selectedMinute={selectedMinute}
              plans={plans}
              activePlan={activePlan}
              activePlanIndex={activePlanIndex}
              routeProfile={routeProfile}
              hasFavoriteRoutes={favoriteRoutes.length > 0}
              onFromSelect={(point) => {
                setFromPoint(point);
                setMapPointTarget("to");
              }}
              onToSelect={(point) => {
                setToPoint(point);
                setMapPointTarget("from");
              }}
              onSwap={() => {
                setFromPoint(toPoint);
                setToPoint(fromPoint);
              }}
              onLocate={locate}
              onStartPicking={startPicking}
              onPlanSelect={(index) => {
                setActivePlanIndex(index);
                if (window.matchMedia("(max-width: 899px)").matches) {
                  setPanelOpen(false);
                }
              }}
              onRouteProfileChange={chooseRouteProfile}
              onJourneyTimeModeChange={setJourneyTimeMode}
              onJourneyTimeChange={setJourneyTime}
              onStartJourney={startJourney}
              onError={showToast}
            />
            )
          )}
          {panelTab === "catalog" && (
            selectedStop !== null ? (
              <TransitStopDetails
                data={data}
                stopIndex={selectedStop}
                onClose={() => setSelectedStop(null)}
                onRoute={chooseRoute}
              />
            ) : selectedRoute !== null ? (
              <TransitRouteDetails
                data={data}
                routeIndex={selectedRoute}
                vehicles={vehicles}
                alerts={alerts}
                favorite={favoriteRoutes.includes(data.routes[selectedRoute][0])}
                onFavorite={() => toggleFavoriteRoute(data.routes[selectedRoute][0])}
                onClose={() => setSelectedRoute(null)}
                onStop={chooseStop}
              />
            ) : (
              <TransitCatalogPanel
                data={data}
                routeList={routeList}
                counts={counts}
                routeMode={routeMode}
                routeQuery={routeQuery}
                selectedRoute={selectedRoute}
                selectedMetroLine={selectedMetroLine}
                vehicles={vehicles}
                favoriteRoutes={favoriteRoutes}
                onModeChange={setRouteMode}
                onQueryChange={setRouteQuery}
                onRoute={chooseRoute}
                onMetroLine={chooseMetroLine}
                onFavorite={toggleFavoriteRoute}
              />
            )
          )}
          {panelTab === "alerts" && (
            <TransitAlertsPanel
              alerts={alerts}
              error={alertsError}
              enabled={alertsEnabled}
              onEnable={enableAlerts}
            />
          )}
        </div>
      </aside>

      <TransitFloatingControls
        panelOpen={panelOpen}
        panelTab={panelTab}
        pickingPoint={pickingPoint}
        mapPointTarget={mapPointTarget}
        selectedRoute={selectedRouteMeta}
        selectedRouteVehicleCount={selectedRouteVehicles.length}
        selectedMetroLine={selectedMetroLine}
        favoriteRoutes={favoriteRoutes}
        journeyActive={journeyActive}
        activePlan={activePlan}
        journeyLegIndex={journeyLegIndex}
        alertsCount={alerts.length}
        onPanel={openPanel}
        onMap={() => setPanelOpen(false)}
        onCancelPicking={() => setPickingPoint(false)}
        onFavorite={toggleFavoriteRoute}
        onClearRoute={() => setSelectedRoute(null)}
        onClearMetro={() => setSelectedMetroLine(null)}
      />
    </section>
  );
}
