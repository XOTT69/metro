"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import TransitMap from "./TransitMap";
import { decodeGtfsRealtime, type LiveVehicle } from "./gtfs-realtime";
import { LINE_META, LINE_STATIONS, type LineId } from "./metro-data";
import {
  findTransitPlansBetweenPoints,
  transitModeLabel,
  type TransitCoordinate,
  type TransitMode,
  type TransitNetworkData,
  type TransitPlan,
} from "./transit-router";
import "./city-transit.css";

type TransportAlert = {
  id: string;
  title: string;
  text: string;
  publishedAt: string;
  url: string;
  source: string;
};

type AddressResult = TransitCoordinate & {
  detail: string;
  type: string;
};

type PanelTab = "plan" | "catalog" | "alerts";
type CatalogMode = "all" | "metro" | "bus" | "trolleybus" | "tram";

const MODE_ICON: Record<TransitMode, string> = {
  metro: "M",
  bus: "A",
  trolleybus: "Т",
  tram: "Тр",
  regional: "Пр",
  walk: "↟",
};

const MODE_COLOR: Record<TransitMode, string> = {
  metro: "#0a865b",
  bus: "#e58a14",
  trolleybus: "#2576d2",
  tram: "#d83d50",
  regional: "#7043c5",
  walk: "#68736e",
};

const geocodeCache = new Map<string, AddressResult[]>();

function isInsideKyiv(point: TransitCoordinate) {
  return (
    point.lat >= 50.2 &&
    point.lat <= 50.68 &&
    point.lon >= 30.18 &&
    point.lon <= 30.9
  );
}

async function searchAddress(query: string) {
  const key = query.toLocaleLowerCase("uk-UA").trim();
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;
  const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error("geocode");
  const payload = (await response.json()) as { results: AddressResult[] };
  geocodeCache.set(key, payload.results);
  return payload.results;
}

function AddressField({
  marker,
  label,
  point,
  placeholder,
  onSelect,
  onError,
}: {
  marker: string;
  label: string;
  point: TransitCoordinate | null;
  placeholder: string;
  onSelect: (point: TransitCoordinate) => void;
  onError: (message: string) => void;
}) {
  const [value, setValue] = useState(point?.name || "");
  const [results, setResults] = useState<AddressResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    setValue(point?.name || "");
  }, [point]);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 3 || query === point?.name) {
      setOpen(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setLoading(true);
      searchAddress(query)
        .then((next) => {
          setResults(next);
          setOpen(true);
        })
        .catch(() => onErrorRef.current("Пошук адрес тимчасово недоступний"))
        .finally(() => setLoading(false));
    }, 380);
    return () => window.clearTimeout(timer);
  }, [point?.name, value]);

  return (
    <div className="transport-address-field">
      <span className={`transport-address-marker is-${marker.toLowerCase()}`}>
        {marker}
      </span>
      <label>
        <small>{label}</small>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="street-address"
          aria-label={label}
          aria-expanded={open}
          role="combobox"
        />
      </label>
      {loading && <span className="transport-address-loading" aria-label="Пошук" />}
      {open && (
        <div className="transport-address-results" role="listbox">
          {results.length ? (
            results.map((result) => (
              <button
                type="button"
                role="option"
                key={result.id}
                onClick={() => {
                  onSelect(result);
                  setValue(result.name);
                  setOpen(false);
                }}
              >
                <span>⌖</span>
                <span>
                  <strong>{result.name}</strong>
                  <small>{result.detail}</small>
                </span>
              </button>
            ))
          ) : (
            <p>Нічого не знайдено. Уточніть адресу.</p>
          )}
          <footer>OpenStreetMap · Київ і Київська область</footer>
        </div>
      )}
    </div>
  );
}

function PlanServices({ plan }: { plan: TransitPlan }) {
  return (
    <div className="transport-plan-services" aria-label="Транспорт у маршруті">
      {plan.legs
        .filter((leg) => leg.route)
        .map((leg, index) => (
          <span
            key={`${leg.route!.id}-${index}`}
            style={{ background: leg.route!.color }}
          >
            {leg.route!.short}
          </span>
        ))}
      {!plan.legs.some((leg) => leg.route) && <span>Пішки</span>}
    </div>
  );
}

function PlanDetails({ plan }: { plan: TransitPlan }) {
  return (
    <ol className="transport-journey">
      <li className="is-endpoint is-start">
        <span>А</span>
        <div>
          <small>Початок</small>
          <strong>{plan.from.name}</strong>
        </div>
      </li>
      {plan.legs.map((leg, index) => (
        <li key={`${leg.from.id}-${leg.to.id}-${index}`}>
          <span
            className="transport-journey-mode"
            style={{ background: leg.route?.color || MODE_COLOR.walk }}
          >
            {leg.route?.short || MODE_ICON.walk}
          </span>
          <div>
            <small>
              {leg.route
                ? `${transitModeLabel(leg.mode)} · ${leg.route.long}`
                : "Пішки"}
            </small>
            <strong>
              {leg.from.name} → {leg.to.name}
            </strong>
            <span>
              ≈ {Math.max(1, Math.round((leg.seconds + leg.waitSeconds) / 60))} хв
              {leg.route && leg.stops > 1 ? ` · ${leg.stops} зуп.` : ""}
            </span>
          </div>
        </li>
      ))}
      <li className="is-endpoint is-finish">
        <span>Б</span>
        <div>
          <small>Фініш</small>
          <strong>{plan.to.name}</strong>
        </div>
      </li>
    </ol>
  );
}

export default function CityTransit({
  showToast,
  onBackToMetro,
}: {
  showToast: (message: string) => void;
  onBackToMetro: () => void;
}) {
  const [data, setData] = useState<TransitNetworkData | null>(null);
  const [loadError, setLoadError] = useState(false);
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
  const [vehicles, setVehicles] = useState<LiveVehicle[]>([]);
  const [liveUpdatedAt, setLiveUpdatedAt] = useState<Date | null>(null);
  const [liveError, setLiveError] = useState(false);
  const [alerts, setAlerts] = useState<TransportAlert[]>([]);
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

  useEffect(() => {
    fetch("/transit-network.json")
      .then((response) => {
        if (!response.ok) throw new Error("network");
        return response.json() as Promise<TransitNetworkData>;
      })
      .then((network: TransitNetworkData) => setData(network))
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    let active = true;
    const updateVehicles = () => {
      fetch("/api/realtime")
        .then((response) => {
          if (!response.ok) throw new Error("realtime");
          return response.arrayBuffer();
        })
        .then((buffer) => {
          if (!active) return;
          const nextVehicles = decodeGtfsRealtime(buffer);
          setVehicles(nextVehicles);
          const timestamp = Math.max(
            ...nextVehicles.map((vehicle) => vehicle.timestamp),
            0,
          );
          setLiveUpdatedAt(timestamp ? new Date(timestamp * 1_000) : new Date());
          setLiveError(false);
        })
        .catch(() => active && setLiveError(true));
    };
    updateVehicles();
    const timer = window.setInterval(updateVehicles, 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const updateAlerts = () => {
      fetch("/api/alerts")
        .then((response) => {
          if (!response.ok) throw new Error("alerts");
          return response.json() as Promise<{ alerts: TransportAlert[] }>;
        })
        .then(({ alerts: nextAlerts }: { alerts: TransportAlert[] }) => {
          if (active) setAlerts(nextAlerts);
        })
        .catch(() => undefined);
    };
    updateAlerts();
    const timer = window.setInterval(updateAlerts, 300_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

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
            <div className="transport-plan-panel">
              <div className="transport-address-card">
                <AddressField
                  marker="A"
                  label="Звідки"
                  point={fromPoint}
                  placeholder="Адреса, зупинка або місто"
                  onSelect={(point) => {
                    setFromPoint(point);
                    setMapPointTarget("to");
                  }}
                  onError={showToast}
                />
                <button
                  type="button"
                  className="transport-swap"
                  onClick={() => {
                    setFromPoint(toPoint);
                    setToPoint(fromPoint);
                  }}
                  aria-label="Поміняти адреси місцями"
                >
                  ⇅
                </button>
                <AddressField
                  marker="Б"
                  label="Куди"
                  point={toPoint}
                  placeholder="Куди потрібно доїхати"
                  onSelect={(point) => {
                    setToPoint(point);
                    setMapPointTarget("from");
                  }}
                  onError={showToast}
                />
                <div className="transport-address-actions">
                  <button type="button" onClick={locate}>◎ Моє місце</button>
                  <button
                    type="button"
                    onClick={() => startPicking(fromPoint ? "to" : "from")}
                  >
                    ⌖ Вказати на карті
                  </button>
                </div>
              </div>

              {!fromPoint || !toPoint ? (
                <div className="transport-empty">
                  <span>↗</span>
                  <h2>{!fromPoint ? "Оберіть точку старту" : "Куди їдемо?"}</h2>
                  <p>
                    Введіть адресу або виберіть точку на карті. Після другої
                    точки варіанти з’являться автоматично.
                  </p>
                </div>
              ) : regionRouteRequested ? (
                <div className="transport-region-note">
                  <span>Київська область</span>
                  <h2>Адресу знайдено, але маршрут не вигадуємо</h2>
                  <p>
                    Для поїздок областю потрібні офіційні розклади приміських
                    перевізників. Карта й пошук області працюють, а неточний
                    розрахунок часу ми свідомо не показуємо.
                  </p>
                </div>
              ) : plans.length ? (
                <>
                  <div className="transport-results-heading">
                    <span>Знайдено {plans.length} варіанти</span>
                    <strong>
                      {activePlan?.totalMinutes
                        ? `≈ ${activePlan.totalMinutes} хв`
                        : "Маршрут"}
                    </strong>
                  </div>
                  <div className="transport-plan-options">
                    {plans.map((plan, index) => (
                      <button
                        type="button"
                        key={`${plan.totalMinutes}-${index}`}
                        className={activePlanIndex === index ? "is-active" : ""}
                        onClick={() => setActivePlanIndex(index)}
                      >
                        <PlanServices plan={plan} />
                        <span>
                          {plan.transfers
                            ? `${plan.transfers} перес.`
                            : "без пересадок"}
                          {" · "}
                          пішки {plan.walkMinutes} хв
                        </span>
                        <strong>{plan.totalMinutes}<small> хв</small></strong>
                      </button>
                    ))}
                  </div>
                  {activePlan && (
                    <>
                      <div className="transport-trip-summary">
                        <div>
                          <small>Прибуття</small>
                          <strong>
                            {new Date(
                              Date.now() + activePlan.totalMinutes * 60_000,
                            ).toLocaleTimeString("uk-UA", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </strong>
                        </div>
                        <div>
                          <small>Пересадки</small>
                          <strong>{activePlan.transfers}</strong>
                        </div>
                        <div>
                          <small>Пішки</small>
                          <strong>{activePlan.walkMinutes} хв</strong>
                        </div>
                      </div>
                      <PlanDetails plan={activePlan} />
                    </>
                  )}
                </>
              ) : (
                <div className="transport-empty">
                  <span>!</span>
                  <h2>Маршрут не знайдено</h2>
                  <p>Спробуйте сусідню адресу або точку на карті.</p>
                </div>
              )}
            </div>
          )}

          {panelTab === "catalog" && (
            <div className="transport-catalog-panel">
              <div className="transport-section-heading">
                <div>
                  <small>Лінії та номери</small>
                  <h2>Транспорт Києва</h2>
                </div>
                <span>{routeList.length} маршрутів</span>
              </div>
              <div className="transport-mode-filter">
                {(
                  [
                    ["all", "Усі", data?.routes.length || 0],
                    ["metro", "Метро", 3],
                    ["bus", "Автобус", counts.bus],
                    ["trolleybus", "Тролейбус", counts.trolleybus],
                    ["tram", "Трамвай", counts.tram],
                  ] as const
                ).map(([mode, label, count]) => (
                  <button
                    type="button"
                    className={routeMode === mode ? "is-active" : ""}
                    onClick={() => setRouteMode(mode)}
                    key={mode}
                  >
                    <i
                      style={{
                        background:
                          mode === "all" ? "#192720" : MODE_COLOR[mode],
                      }}
                    />
                    {label}
                    <b>{count || "—"}</b>
                  </button>
                ))}
              </div>
              {routeMode !== "metro" && (
                <label className="transport-route-search">
                  <span>⌕</span>
                  <input
                    value={routeQuery}
                    onChange={(event) => setRouteQuery(event.target.value)}
                    placeholder="Номер або назва маршруту"
                  />
                </label>
              )}
              {(routeMode === "all" || routeMode === "metro") && (
                <div className="transport-metro-lines">
                  {(Object.keys(LINE_META) as LineId[]).map((line) => (
                    <button
                      type="button"
                      className={selectedMetroLine === line ? "is-active" : ""}
                      onClick={() => chooseMetroLine(line)}
                      key={line}
                    >
                      <span style={{ background: LINE_META[line].color }}>
                        {LINE_META[line].code}
                      </span>
                      <span>
                        <strong>{LINE_META[line].name}</strong>
                        <small>{LINE_STATIONS[line].length} станцій</small>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {routeMode !== "metro" && (
                <div className="transport-route-list">
                  {routeList.map(({ route, index }) => (
                    <div
                      className={selectedRoute === index ? "is-active" : ""}
                      key={route[0]}
                      style={{ "--route-color": `#${route[4]}` } as CSSProperties}
                    >
                      <button type="button" onClick={() => chooseRoute(index)}>
                        <span>{route[1]}</span>
                        <span>
                          <strong>{route[2]}</strong>
                          <small>
                            {transitModeLabel(route[3])}
                            {vehicles.some(
                              (vehicle) => vehicle.routeId === route[0],
                            )
                              ? " · наживо"
                              : ""}
                          </small>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleFavoriteRoute(route[0])}
                        aria-label="Додати маршрут в обране"
                      >
                        {favoriteRoutes.includes(route[0]) ? "★" : "☆"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {panelTab === "alerts" && (
            <div className="transport-alerts-panel">
              <div className="transport-section-heading">
                <div>
                  <small>Оперативно від міста</small>
                  <h2>Зміни руху</h2>
                </div>
                <button
                  type="button"
                  className={alertsEnabled ? "is-enabled" : ""}
                  onClick={enableAlerts}
                >
                  {alertsEnabled ? "✓ Увімкнено" : "Сповіщати"}
                </button>
              </div>
              <div className="transport-alert-list">
                {alerts.length ? (
                  alerts.map((alert) => (
                    <a
                      key={alert.id}
                      href={alert.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span>{alert.source}</span>
                      <strong>{alert.title}</strong>
                      <p>{alert.text}</p>
                      <small>
                        {new Date(alert.publishedAt).toLocaleString("uk-UA", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        · відкрити ↗
                      </small>
                    </a>
                  ))
                ) : (
                  <div className="transport-empty">
                    <h2>Оновлень поки немає</h2>
                    <p>Нові повідомлення міста з’являться тут автоматично.</p>
                  </div>
                )}
              </div>
            </div>
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
