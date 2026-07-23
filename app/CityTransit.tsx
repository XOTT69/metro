"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import TransitMap from "./TransitMap";
import { LINE_META, type LineId } from "./metro-data";
import {
  findTransitPlansBetweenPoints,
  transitModeLabel,
  type TransitCoordinate,
} from "./transit-router";
import TransitAlertsPanel from "./city-transit/TransitAlertsPanel";
import TransitCatalogPanel from "./city-transit/TransitCatalogPanel";
import TransitPlanPanel from "./city-transit/TransitPlanPanel";
import { useLiveVehicles } from "./city-transit/hooks/useLiveVehicles";
import { useTransitNetwork } from "./city-transit/hooks/useTransitNetwork";
import { useTransportAlerts } from "./city-transit/hooks/useTransportAlerts";
import {
  isInsideKyiv,
  type CatalogMode,
  type PanelTab,
} from "./city-transit/model";
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
  const [panelTab, setPanelTab] = useState<PanelTab>("plan");
  const [panelOpen, setPanelOpen] = useState(
    () => window.matchMedia("(min-width: 900px)").matches,
  );
  const [searchExpanded, setSearchExpanded] = useState(
    () => window.matchMedia("(min-width: 900px)").matches,
  );
  const [routeMode, setRouteMode] = useState<CatalogMode>("all");
  const [routeQuery, setRouteQuery] = useState("");
  const [selectedRoute, setSelectedRoute] = useState<number | null>(null);
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
  const plans = useMemo(
    () =>
      data && fromPoint && toPoint && !regionRouteRequested
        ? findTransitPlansBetweenPoints(data, fromPoint, toPoint, 3)
        : [],
    [data, fromPoint, regionRouteRequested, toPoint],
  );
  const activePlan = plans[activePlanIndex] || plans[0] || null;

  useEffect(() => {
    setActivePlanIndex(0);
    setSelectedRoute(null);
    setSelectedMetroLine(null);
  }, [fromPoint, toPoint]);

  const routeList = useMemo(() => {
    if (!data) return [];
    const collator = new Intl.Collator("uk", { numeric: true });
    const query = routeQuery.toLocaleLowerCase("uk-UA").trim();
    return data.routes
      .map((route, index) => ({ route, index }))
      .filter(({ route }) => {
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

  const counts = useMemo(() => {
    const result = { bus: 0, trolleybus: 0, tram: 0 };
    if (!data) return result;
    data.routes.forEach((route) => {
      if (route[3] === "bus") result.bus += 1;
      if (route[3] === "trolleybus") result.trolleybus += 1;
      if (route[3] === "tram") result.tram += 1;
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
    setSelectedMetroLine(null);
    if (window.matchMedia("(max-width: 899px)").matches) setPanelOpen(false);
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
        onLocate={locate}
        onMapPoint={selectMapPoint}
        showRegion={regionRouteRequested}
        pickingPoint={pickingPoint}
      />

      <header className={`transport-hub-search ${searchExpanded ? "is-expanded" : ""}`}>
        <button
          type="button"
          className="transport-back"
          onClick={onBackToMetro}
          aria-label="Повернутися до метро"
        >
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
          <span>{liveError ? "без live" : `${vehicles.length} live`}</span>
        </div>
      </header>

      <aside className={`transport-hub-panel ${panelOpen ? "is-open" : ""}`}>
        <div className="transport-panel-brand">
          <button type="button" onClick={onBackToMetro}>
            <img src="/metro-logo.svg" alt="" />
            <span>
              <strong>Metro Kyiv</strong>
              <small>Назад до метро</small>
            </span>
          </button>
          <div className={`transport-live-status ${liveError ? "is-error" : ""}`}>
            <i />
            <span>
              {liveError
                ? "Live недоступний"
                : `${vehicles.length} на карті${
                    liveUpdatedAt
                      ? ` · ${liveUpdatedAt.toLocaleTimeString("uk-UA", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`
                      : ""
                  }`}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="transport-sheet-handle"
          onClick={() => setPanelOpen(false)}
          aria-label="Згорнути панель"
        >
          <span />
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
            <TransitPlanPanel
              fromPoint={fromPoint}
              toPoint={toPoint}
              regionRouteRequested={regionRouteRequested}
              plans={plans}
              activePlan={activePlan}
              activePlanIndex={activePlanIndex}
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
              onPlanSelect={setActivePlanIndex}
              onError={showToast}
            />
          )}
          {panelTab === "catalog" && (
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

      {pickingPoint && (
        <div className="transport-picking-banner">
          <strong>Точка {mapPointTarget === "from" ? "А" : "Б"}</strong>
          <span>Торкніться потрібного місця на карті</span>
          <button type="button" onClick={() => setPickingPoint(false)}>Скасувати</button>
        </div>
      )}

      {(selectedRouteMeta || selectedMetroLine) && !panelOpen && (
        <div className="transport-selected-card">
          {selectedRouteMeta ? (
            <>
              <span style={{ background: `#${selectedRouteMeta[4]}` }}>
                {selectedRouteMeta[1]}
              </span>
              <div>
                <small>
                  {transitModeLabel(selectedRouteMeta[3])} ·{" "}
                  {selectedRouteVehicles.length
                    ? `${selectedRouteVehicles.length} на карті`
                    : "маршрут"}
                </small>
                <strong>{selectedRouteMeta[2]}</strong>
              </div>
              <button
                type="button"
                onClick={() => toggleFavoriteRoute(selectedRouteMeta[0])}
                aria-label="Додати маршрут в обране"
              >
                {favoriteRoutes.includes(selectedRouteMeta[0]) ? "★" : "☆"}
              </button>
            </>
          ) : (
            <>
              <span style={{ background: LINE_META[selectedMetroLine!].color }}>
                {LINE_META[selectedMetroLine!].code}
              </span>
              <div>
                <small>Метрополітен</small>
                <strong>{LINE_META[selectedMetroLine!].name}</strong>
              </div>
            </>
          )}
        </div>
      )}

      <nav className="transport-bottom-nav" aria-label="Навігація транспортом">
        {(
          [
            ["plan", "↗", "Маршрут"],
            ["catalog", "≋", "Транспорт"],
            ["alerts", "!", "Зміни"],
          ] as const
        ).map(([tab, icon, label]) => (
          <button
            type="button"
            className={panelTab === tab && panelOpen ? "is-active" : ""}
            onClick={() => {
              if (panelTab === tab && panelOpen) setPanelOpen(false);
              else openPanel(tab);
            }}
            key={tab}
          >
            <span>{icon}</span>
            {label}
            {tab === "alerts" && alerts.length > 0 && <i>{alerts.length}</i>}
          </button>
        ))}
      </nav>
    </section>
  );
}
