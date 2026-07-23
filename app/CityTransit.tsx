"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import TransitMap from "./TransitMap";
import { decodeGtfsRealtime, type LiveVehicle } from "./gtfs-realtime";
import { LINE_META, LINE_STATIONS, type LineId } from "./metro-data";
import {
  REGIONAL_HUBS,
  findTransitPlansBetweenPoints,
  transitModeLabel,
  type TransitCoordinate,
  type TransitMode,
  type TransitNetworkData,
  type TransitPlan,
} from "./transit-router";

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

type PanelTab = "nearby" | "route" | "transport" | "alerts";
type CatalogMode =
  | "all"
  | "metro"
  | "bus"
  | "trolleybus"
  | "tram"
  | "regional";

const MODE_ICON: Record<TransitMode, string> = {
  metro: "M",
  bus: "A",
  trolleybus: "Т",
  tram: "Тр",
  regional: "Пр",
  walk: "↟",
};

const MODE_COLOR: Record<TransitMode, string> = {
  metro: "#13885f",
  bus: "#ee9414",
  trolleybus: "#2877d5",
  tram: "#df4053",
  regional: "#7a45d6",
  walk: "#66736e",
};

const geocodeCache = new Map<string, AddressResult[]>();

function vehicleMode(routeId: string): Exclude<
  TransitMode,
  "metro" | "regional" | "walk"
> {
  if (routeId.startsWith("1_")) return "tram";
  if (routeId.startsWith("2_")) return "trolleybus";
  return "bus";
}

function distanceMeters(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
) {
  const latScale = 111_320;
  const lonScale =
    Math.cos(((a.lat + b.lat) * Math.PI) / 360) * 111_320;
  return Math.hypot(
    (a.lat - b.lat) * latScale,
    (a.lon - b.lon) * lonScale,
  );
}

function planDistanceKm(plan: TransitPlan) {
  const meters = plan.legs.reduce((total, leg) => {
    return (
      total +
      leg.path.slice(1).reduce(
        (sum, place, index) =>
          sum + distanceMeters(leg.path[index], place),
        0,
      )
    );
  }, 0);
  return Math.max(0.1, meters / 1_000);
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

  useEffect(() => {
    setValue(point?.name || "");
  }, [point]);

  const submit = async () => {
    if (value.trim().length < 3) {
      onError("Введіть щонайменше три символи адреси");
      return;
    }
    setLoading(true);
    try {
      const next = await searchAddress(value.trim());
      setResults(next);
      setOpen(true);
      if (!next.length) {
        onError("У Києві та області такої адреси не знайдено");
      }
    } catch {
      onError("Пошук адрес тимчасово недоступний");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="address-field">
      <span className={`address-marker is-${marker.toLocaleLowerCase()}`}>
        {marker}
      </span>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label>
          <small>{label}</small>
          <input
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setOpen(false);
            }}
            placeholder={placeholder}
            autoComplete="street-address"
            aria-label={label}
          />
        </label>
        <button
          type="submit"
          aria-label={`Знайти: ${label}`}
          disabled={loading}
        >
          {loading ? "…" : "⌕"}
        </button>
      </form>
      {open && results.length > 0 && (
        <div className="address-results" role="listbox">
          {results.map((result) => (
            <button
              type="button"
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
          ))}
          <p>OpenStreetMap · Київ та Київська область</p>
        </div>
      )}
    </div>
  );
}

function PlanServices({ plan }: { plan: TransitPlan }) {
  return (
    <div className="plan-services" aria-label="Транспорт у маршруті">
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
      {!plan.legs.some((leg) => leg.route) && (
        <span className="is-walk">Пішки</span>
      )}
    </div>
  );
}

function PlanDetails({ plan }: { plan: TransitPlan }) {
  return (
    <div className="journey-detail">
      <div className="journey-endpoint is-start">
        <span>A</span>
        <strong>{plan.from.name}</strong>
      </div>
      <ol className="journey-steps">
        {plan.legs.map((leg, index) => (
          <li key={`${leg.from.id}-${leg.to.id}-${index}`}>
            <span
              className="journey-mode"
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
                {leg.from.name} <i>→</i> {leg.to.name}
              </strong>
              <span>
                ◷{" "}
                {Math.max(
                  1,
                  Math.round((leg.seconds + leg.waitSeconds) / 60),
                )}{" "}
                хв
                {leg.route && leg.stops > 1
                  ? ` · ${leg.stops} зуп.`
                  : ""}
              </span>
            </div>
          </li>
        ))}
      </ol>
      <div className="journey-endpoint is-finish">
        <span>Б</span>
        <strong>{plan.to.name}</strong>
      </div>
    </div>
  );
}

export default function CityTransit({
  showToast,
}: {
  showToast: (message: string) => void;
}) {
  const [data, setData] = useState<TransitNetworkData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [fromPoint, setFromPoint] = useState<TransitCoordinate | null>(null);
  const [toPoint, setToPoint] = useState<TransitCoordinate | null>(null);
  const [mapPointTarget, setMapPointTarget] = useState<"from" | "to">("from");
  const [activePlanIndex, setActivePlanIndex] = useState(0);
  const [panelTab, setPanelTab] = useState<PanelTab>("nearby");
  const [panelOpen, setPanelOpen] = useState(
    () => window.matchMedia("(min-width: 761px)").matches,
  );
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [routeMode, setRouteMode] = useState<CatalogMode>("all");
  const [routeQuery, setRouteQuery] = useState("");
  const [selectedRoute, setSelectedRoute] = useState<number | null>(null);
  const [selectedMetroLine, setSelectedMetroLine] =
    useState<LineId | null>(null);
  const [showRegion, setShowRegion] = useState(false);
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
        return response.json();
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
          setLiveUpdatedAt(
            timestamp ? new Date(timestamp * 1_000) : new Date(),
          );
          setLiveError(false);
        })
        .catch(() => {
          if (active) setLiveError(true);
        });
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
          return response.json();
        })
        .then(async ({ alerts: nextAlerts }: { alerts: TransportAlert[] }) => {
          if (!active) return;
          setAlerts(nextAlerts);
          const latest = nextAlerts[0];
          const saved = localStorage.getItem(
            "metro-kyiv:last-transport-alert",
          );
          if (
            latest &&
            alertsEnabled &&
            saved &&
            saved !== latest.id &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            const registration = await navigator.serviceWorker?.ready;
            await registration?.showNotification(latest.title, {
              body: latest.text.slice(0, 180),
              icon: "/metro-logo.svg",
              badge: "/metro-logo.svg",
              tag: `transport-${latest.id}`,
              data: { url: latest.url },
            });
          }
          if (latest) {
            localStorage.setItem(
              "metro-kyiv:last-transport-alert",
              latest.id,
            );
          }
        })
        .catch(() => undefined);
    };
    updateAlerts();
    const timer = window.setInterval(updateAlerts, 300_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [alertsEnabled]);

  const plans = useMemo(
    () =>
      data && fromPoint && toPoint
        ? findTransitPlansBetweenPoints(data, fromPoint, toPoint, 4)
        : [],
    [data, fromPoint, toPoint],
  );
  const activePlan = plans[activePlanIndex] || plans[0] || null;

  useEffect(() => {
    setActivePlanIndex(0);
    setSelectedRoute(null);
    setSelectedMetroLine(null);
  }, [fromPoint, toPoint]);

  const routeList = useMemo(() => {
    if (!data || routeMode === "regional") return [];
    const collator = new Intl.Collator("uk", { numeric: true });
    return data.routes
      .map((route, index) => ({ route, index }))
      .filter(({ route }) =>
        routeMode === "all"
          ? true
          : routeMode === "metro"
            ? false
            : route[3] === routeMode,
      )
      .filter(({ route }) =>
        `${route[1]} ${route[2]}`
          .toLocaleLowerCase("uk-UA")
          .includes(routeQuery.toLocaleLowerCase("uk-UA").trim()),
      )
      .sort((a, b) => {
        const favoriteDifference =
          Number(favoriteRoutes.includes(b.route[0])) -
          Number(favoriteRoutes.includes(a.route[0]));
        return (
          favoriteDifference || collator.compare(a.route[1], b.route[1])
        );
      });
  }, [data, favoriteRoutes, routeMode, routeQuery]);

  const counts = useMemo(() => {
    const result = { bus: 0, trolleybus: 0, tram: 0 };
    vehicles.forEach((vehicle) => {
      result[vehicleMode(vehicle.routeId)] += 1;
    });
    return result;
  }, [vehicles]);

  const nearbyRoutes = useMemo(() => {
    if (!data) return [];
    const liveByRoute = new Map<string, number>();
    vehicles.forEach((vehicle) => {
      liveByRoute.set(
        vehicle.routeId,
        (liveByRoute.get(vehicle.routeId) || 0) + 1,
      );
    });
    return data.routes
      .map((route, index) => ({
        route,
        index,
        live: liveByRoute.get(route[0]) || 0,
      }))
      .filter((item) => item.live > 0)
      .sort(
        (a, b) =>
          Number(favoriteRoutes.includes(b.route[0])) -
            Number(favoriteRoutes.includes(a.route[0])) ||
          b.live - a.live,
      )
      .slice(0, 14);
  }, [data, favoriteRoutes, vehicles]);

  const selectedRouteMeta =
    selectedRoute !== null && data ? data.routes[selectedRoute] : null;
  const selectedRouteVehicles = selectedRouteMeta
    ? vehicles.filter(
        (vehicle) => vehicle.routeId === selectedRouteMeta[0],
      )
    : [];

  const locate = () => {
    if (!navigator.geolocation) {
      showToast("Геолокація недоступна");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setFromPoint({
          id: `geo:${coords.latitude.toFixed(5)}:${coords.longitude.toFixed(
            5,
          )}`,
          name: "Моя геопозиція",
          detail: "Поточне місце",
          lat: coords.latitude,
          lon: coords.longitude,
        });
        setMapPointTarget("to");
        setSearchExpanded(true);
        setPanelTab("route");
        setPanelOpen(true);
        showToast("Точку А встановлено");
      },
      () => showToast("Не вдалося отримати геопозицію"),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const selectMapPoint = (latitude: number, longitude: number) => {
    const point: TransitCoordinate = {
      id: `map:${latitude.toFixed(5)}:${longitude.toFixed(5)}`,
      name: "Точка на карті",
      detail: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      lat: latitude,
      lon: longitude,
    };
    if (mapPointTarget === "from" || !fromPoint) {
      setFromPoint(point);
      setMapPointTarget("to");
      showToast("Точку А встановлено. Тепер оберіть точку Б");
    } else {
      setToPoint(point);
      setMapPointTarget("from");
      setPanelOpen(true);
      showToast("Маршрут побудовано");
    }
    setSearchExpanded(true);
    setPanelTab("route");
  };

  const chooseRoute = (index: number) => {
    setSelectedRoute(index);
    setSelectedMetroLine(null);
    setPanelTab("transport");
    if (window.matchMedia("(max-width: 760px)").matches) {
      setPanelOpen(false);
    }
  };

  const chooseMetroLine = (line: LineId) => {
    setSelectedMetroLine(line);
    setSelectedRoute(null);
    setPanelTab("transport");
    if (window.matchMedia("(max-width: 760px)").matches) {
      setPanelOpen(false);
    }
  };

  const chooseRegionalHub = (hub: (typeof REGIONAL_HUBS)[number]) => {
    const point: TransitCoordinate = {
      id: `region:${hub.id}`,
      name: hub.name,
      detail: "Київська область",
      lat: hub.lat,
      lon: hub.lon,
    };
    if (!fromPoint || (fromPoint && toPoint)) {
      setFromPoint(point);
      setToPoint(null);
      setMapPointTarget("to");
      showToast(`${hub.name}: оберіть пункт призначення`);
    } else {
      setToPoint(point);
      setMapPointTarget("from");
      showToast(`Маршрут до ${hub.name} побудовано`);
    }
    setShowRegion(true);
    setSearchExpanded(true);
    setPanelTab("route");
    setPanelOpen(true);
  };

  const toggleFavoriteRoute = (routeId: string) => {
    const next = favoriteRoutes.includes(routeId)
      ? favoriteRoutes.filter((id) => id !== routeId)
      : [...favoriteRoutes, routeId];
    setFavoriteRoutes(next);
    localStorage.setItem(
      "metro-kyiv:favorite-routes",
      JSON.stringify(next),
    );
    showToast(
      next.includes(routeId)
        ? "Маршрут додано в обране"
        : "Маршрут видалено з обраного",
    );
  };

  const shareSelectedRoute = async () => {
    if (!selectedRouteMeta) return;
    const text = `${transitModeLabel(selectedRouteMeta[3])} ${
      selectedRouteMeta[1]
    }: ${selectedRouteMeta[2]}`;
    if (navigator.share) {
      await navigator.share({ title: "Metro Kyiv", text });
    } else {
      await navigator.clipboard.writeText(text);
      showToast("Інформацію про маршрут скопійовано");
    }
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
    showToast("Сповіщення про транспорт увімкнено");
  };

  if (loadError) {
    return (
      <section className="city-view">
        <div className="empty-state">
          Не вдалося завантажити транспортну мережу. Метро продовжує
          працювати офлайн.
        </div>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="city-view">
        <div className="city-loading">
          <span />
          Готуємо карту Києва та області…
        </div>
      </section>
    );
  }

  const quickRoutes = selectedRouteMeta
    ? [
        {
          route: selectedRouteMeta,
          index: selectedRoute!,
          live: selectedRouteVehicles.length,
        },
        ...nearbyRoutes.filter(
          ({ route }) => route[0] !== selectedRouteMeta[0],
        ),
      ].slice(0, 10)
    : nearbyRoutes.slice(0, 10);

  return (
    <section className="city-view city-explorer">
      <div className="city-map-app">
        <TransitMap
          data={data}
          vehicles={vehicles}
          activePlan={panelTab === "route" ? activePlan : null}
          selectedRoute={panelTab === "transport" ? selectedRoute : null}
          selectedMetroLine={
            panelTab === "transport" ? selectedMetroLine : null
          }
          onLocate={locate}
          onMapPoint={selectMapPoint}
          showRegion={showRegion}
        />

        <header
          className={`city-searchbar ${
            searchExpanded ? "is-expanded" : "is-compact"
          }`}
        >
          <button
            type="button"
            className="city-menu-button"
            onClick={() => setPanelOpen((value) => !value)}
            aria-label="Відкрити меню"
          >
            ☰
          </button>

          {!searchExpanded ? (
            <button
              type="button"
              className="city-destination-prompt"
              onClick={() => {
                setSearchExpanded(true);
                setPanelTab("route");
                setPanelOpen(true);
              }}
            >
              <span>⌕</span>
              <strong>Куди прямуєте?</strong>
            </button>
          ) : (
            <div className="city-addresses">
              <AddressField
                marker="A"
                label="Звідки"
                point={fromPoint}
                placeholder="Адреса, зупинка або місто"
                onSelect={(point) => {
                  setFromPoint(point);
                  setMapPointTarget("to");
                  setPanelTab("route");
                  setPanelOpen(true);
                }}
                onError={showToast}
              />
              <button
                type="button"
                className="city-address-swap"
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
                  setPanelTab("route");
                  setPanelOpen(true);
                }}
                onError={showToast}
              />
            </div>
          )}

          <button
            type="button"
            className={`city-region-button ${showRegion ? "is-active" : ""}`}
            onClick={() => setShowRegion((value) => !value)}
            aria-label="Показати Київську область"
          >
            <span>Київ</span>
            <strong>+ область</strong>
          </button>

          {searchExpanded && (
            <button
              type="button"
              className="city-search-close"
              onClick={() => setSearchExpanded(false)}
              aria-label="Згорнути пошук"
            >
              ×
            </button>
          )}
        </header>

        {!searchExpanded && quickRoutes.length > 0 && (
          <div className="map-route-strip" aria-label="Маршрути наживо">
            <span>▣</span>
            {quickRoutes.map(({ route, index, live }) => (
              <button
                type="button"
                className={selectedRoute === index ? "is-active" : ""}
                style={{ "--route-color": `#${route[4]}` } as CSSProperties}
                onClick={() => chooseRoute(index)}
                key={route[0]}
              >
                {route[1]}
                {live > 0 && <i>{live}</i>}
              </button>
            ))}
            <button
              type="button"
              className="show-all-routes"
              onClick={() => {
                setPanelTab("transport");
                setPanelOpen(true);
              }}
            >
              Усі
            </button>
          </div>
        )}

        <div className="map-floating-tools">
          <button
            type="button"
            onClick={() => {
              setRouteMode("all");
              setPanelTab("transport");
              setPanelOpen(true);
            }}
            aria-label="Маршрути"
          >
            ▦
          </button>
          <button
            type="button"
            onClick={() => {
              setRouteMode("regional");
              setPanelTab("transport");
              setPanelOpen(true);
              setShowRegion(true);
            }}
            aria-label="Транспорт області"
          >
            ◉
          </button>
        </div>

        <aside className={`city-sidepanel ${panelOpen ? "is-open" : ""}`}>
          <button
            type="button"
            className="sheet-handle"
            onClick={() => setPanelOpen(false)}
            aria-label="Згорнути панель"
          >
            <span />
          </button>
          <div className="city-panel-tabs" role="tablist">
            {(
              [
                ["nearby", "Поруч"],
                ["route", "Маршрут"],
                ["transport", "Транспорт"],
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
                {tab === "alerts" && alerts.length > 0 && (
                  <i>{alerts.length}</i>
                )}
              </button>
            ))}
          </div>

          <div className="city-panel-content">
            {panelTab === "nearby" && (
              <div className="nearby-panel">
                <div className="panel-heading">
                  <div>
                    <small>На карті зараз</small>
                    <strong>Транспорт поруч</strong>
                  </div>
                  <span>
                    {liveError ? "без live" : `${vehicles.length} машин`}
                  </span>
                </div>
                <div className="nearby-actions">
                  <button type="button" onClick={locate}>
                    <span>◎</span>
                    <strong>Моє місце</strong>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchExpanded(true);
                      setPanelTab("route");
                    }}
                  >
                    <span>↗</span>
                    <strong>Побудувати</strong>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRouteMode("regional");
                      setPanelTab("transport");
                      setShowRegion(true);
                    }}
                  >
                    <span>◉</span>
                    <strong>Область</strong>
                  </button>
                </div>
                <div className="nearby-route-list">
                  {nearbyRoutes.map(({ route, index, live }) => (
                    <button
                      type="button"
                      onClick={() => chooseRoute(index)}
                      key={route[0]}
                    >
                      <span
                        className="route-badge"
                        style={{ background: `#${route[4]}` }}
                      >
                        {route[1]}
                      </span>
                      <span>
                        <strong>{route[2]}</strong>
                        <small>
                          {transitModeLabel(route[3])} · {live} машин наживо
                        </small>
                      </span>
                      <b>›</b>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {panelTab === "route" && (
              <div className="route-results-panel">
                {!fromPoint || !toPoint ? (
                  <div className="route-empty-prompt">
                    <span>↗</span>
                    <h2>
                      {!fromPoint
                        ? "Звідки починаємо?"
                        : "Куди прямуємо?"}
                    </h2>
                    <p>
                      Введіть адресу у Києві чи області або торкніться
                      потрібного місця на карті.
                    </p>
                    <div>
                      <button type="button" onClick={locate}>
                        ◎ Моє місце
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPanelOpen(false);
                          setMapPointTarget(fromPoint ? "to" : "from");
                          showToast(
                            fromPoint
                              ? "Торкніться карти для точки Б"
                              : "Торкніться карти для точки А",
                          );
                        }}
                      >
                        ⌖ Вибрати на карті
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="panel-heading route-results-heading">
                      <div>
                        <small>Результати пошуку</small>
                        <strong>{plans.length || "—"} варіанти</strong>
                      </div>
                      <span>
                        {activePlan
                          ? `${planDistanceKm(activePlan).toFixed(1)} км`
                          : "не знайдено"}
                      </span>
                    </div>
                    <div className="route-option-list">
                      {plans.map((plan, index) => (
                        <button
                          type="button"
                          key={`${plan.totalMinutes}-${index}`}
                          className={
                            activePlanIndex === index ? "is-active" : ""
                          }
                          onClick={() => setActivePlanIndex(index)}
                        >
                          <PlanServices plan={plan} />
                          <span className="route-option-meta">
                            <small>
                              {plan.transfers
                                ? `${plan.transfers} перес.`
                                : "без пересадок"}
                            </small>
                            <small>
                              {planDistanceKm(plan).toFixed(1)} км
                            </small>
                          </span>
                          <strong>{plan.totalMinutes}<small> хв</small></strong>
                          <b>›</b>
                        </button>
                      ))}
                    </div>
                    {activePlan ? (
                      <>
                        <div className="active-plan-summary">
                          <div>
                            <small>Прибуття</small>
                            <strong>
                              {new Date(
                                Date.now() +
                                  activePlan.totalMinutes * 60_000,
                              ).toLocaleTimeString("uk-UA", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </strong>
                          </div>
                          <div>
                            <small>У дорозі</small>
                            <strong>≈ {activePlan.totalMinutes} хв</strong>
                          </div>
                          <div>
                            <small>Пішки</small>
                            <strong>{activePlan.walkMinutes} хв</strong>
                          </div>
                        </div>
                        <PlanDetails plan={activePlan} />
                        {activePlan.legs.some(
                          (leg) => leg.mode === "regional",
                        ) && (
                          <p className="regional-estimate-note">
                            Приміська ділянка є орієнтовною: фактичний
                            перевізник, розклад і час у дорозі можуть
                            відрізнятися.
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="empty-state">
                        Для цих точок маршрут не знайдено. Спробуйте сусідню
                        адресу або транспортний вузол.
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {panelTab === "transport" && (
              <div className="transport-catalog">
                <div className="panel-heading">
                  <div>
                    <small>Київ та область</small>
                    <strong>Маршрути</strong>
                  </div>
                  <span>
                    {routeMode === "regional"
                      ? `${REGIONAL_HUBS.length} напрямків`
                      : routeMode === "metro"
                        ? "3 лінії"
                        : `${routeList.length} маршрутів`}
                  </span>
                </div>
                <div className="transport-mode-filter">
                  {(
                    [
                      ["all", "Усі", vehicles.length],
                      ["metro", "Метро", 3],
                      ["bus", "Автобус", counts.bus],
                      ["trolleybus", "Тролейбус", counts.trolleybus],
                      ["tram", "Трамвай", counts.tram],
                      ["regional", "Область", REGIONAL_HUBS.length],
                    ] as const
                  ).map(([mode, label, count]) => (
                    <button
                      type="button"
                      className={routeMode === mode ? "is-active" : ""}
                      onClick={() => {
                        setRouteMode(mode);
                        if (mode === "regional") setShowRegion(true);
                      }}
                      key={mode}
                    >
                      <i
                        style={{
                          background:
                            mode === "all"
                              ? "#17241f"
                              : MODE_COLOR[mode],
                        }}
                      />
                      <span>{label}</span>
                      <b>{count || "—"}</b>
                    </button>
                  ))}
                </div>

                {routeMode !== "regional" && (
                  <label className="route-number-search">
                    <span>⌕</span>
                    <input
                      value={routeQuery}
                      onChange={(event) =>
                        setRouteQuery(event.target.value)
                      }
                      placeholder="Номер або назва маршруту"
                    />
                  </label>
                )}

                {(routeMode === "all" || routeMode === "metro") && (
                  <div className="metro-route-grid">
                    {(Object.keys(LINE_META) as LineId[]).map((line) => (
                      <button
                        type="button"
                        className={
                          selectedMetroLine === line ? "is-active" : ""
                        }
                        onClick={() => chooseMetroLine(line)}
                        key={line}
                      >
                        <span
                          style={{ background: LINE_META[line].color }}
                        >
                          {LINE_META[line].code}
                        </span>
                        <span>
                          <strong>{LINE_META[line].name}</strong>
                          <small>
                            {LINE_STATIONS[line].length} станцій
                          </small>
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {routeMode === "regional" ? (
                  <div className="regional-hub-grid">
                    {REGIONAL_HUBS.map((hub) => (
                      <button
                        type="button"
                        onClick={() => chooseRegionalHub(hub)}
                        key={hub.id}
                      >
                        <span>{hub.short}</span>
                        <span>
                          <strong>{hub.name}</strong>
                          <small>
                            ≈ {hub.minutes} хв до вузла метро
                          </small>
                        </span>
                        <b>›</b>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="route-number-grid">
                    {routeList.map(({ route, index }) => (
                      <button
                        type="button"
                        className={
                          selectedRoute === index ? "is-active" : ""
                        }
                        onClick={() => chooseRoute(index)}
                        key={route[0]}
                      >
                        <span style={{ background: `#${route[4]}` }}>
                          {route[1]}
                        </span>
                        <span>
                          <strong>{route[2]}</strong>
                          <small>
                            {transitModeLabel(route[3])}
                            {vehicles.some(
                              (vehicle) =>
                                vehicle.routeId === route[0],
                            )
                              ? " · наживо"
                              : ""}
                          </small>
                        </span>
                        {favoriteRoutes.includes(route[0]) && <b>★</b>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {panelTab === "alerts" && (
              <div className="city-alert-panel">
                <div className="panel-heading">
                  <div>
                    <small>Оперативно від КМДА</small>
                    <strong>Зміни руху</strong>
                  </div>
                  <button
                    type="button"
                    className={alertsEnabled ? "is-enabled" : ""}
                    onClick={enableAlerts}
                  >
                    {alertsEnabled ? "✓ Увімкнено" : "Сповіщати"}
                  </button>
                </div>
                <div className="city-alert-list">
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
                          {new Date(alert.publishedAt).toLocaleString(
                            "uk-UA",
                            {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}{" "}
                          · відкрити ↗
                        </small>
                      </a>
                    ))
                  ) : (
                    <div className="empty-state">
                      Завантажуємо оновлення КМДА…
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>

        {!panelOpen && (
          <button
            type="button"
            className="city-panel-peek"
            onClick={() => setPanelOpen(true)}
          >
            <span />
            <strong>
              {panelTab === "route" && activePlan
                ? `${activePlan.totalMinutes} хв · деталі маршруту`
                : selectedRouteMeta
                  ? `${selectedRouteMeta[1]} · ${selectedRouteVehicles.length} машин`
                  : `${vehicles.length || "—"} машин наживо`}
            </strong>
            <b>⌃</b>
          </button>
        )}

        {(selectedRouteMeta || selectedMetroLine) && !panelOpen && (
          <div className="selected-route-dock">
            {selectedRouteMeta ? (
              <>
                <span style={{ background: `#${selectedRouteMeta[4]}` }}>
                  {selectedRouteMeta[1]}
                </span>
                <div>
                  <small>{transitModeLabel(selectedRouteMeta[3])}</small>
                  <strong>{selectedRouteMeta[2]}</strong>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    toggleFavoriteRoute(selectedRouteMeta[0])
                  }
                  aria-label="Додати маршрут в обране"
                >
                  {favoriteRoutes.includes(selectedRouteMeta[0])
                    ? "★"
                    : "☆"}
                </button>
                <button
                  type="button"
                  onClick={() => void shareSelectedRoute()}
                  aria-label="Поділитися маршрутом"
                >
                  ↗
                </button>
              </>
            ) : (
              <>
                <span
                  style={{
                    background: LINE_META[selectedMetroLine!].color,
                  }}
                >
                  {LINE_META[selectedMetroLine!].code}
                </span>
                <div>
                  <small>Метрополітен</small>
                  <strong>
                    {LINE_STATIONS[selectedMetroLine!][0].name} —{" "}
                    {LINE_STATIONS[selectedMetroLine!].at(-1)!.name}
                  </strong>
                </div>
              </>
            )}
          </div>
        )}

        <div className={`city-live-pill ${liveError ? "is-error" : ""}`}>
          <i />
          <span>
            {liveError
              ? "Live тимчасово недоступний"
              : `${vehicles.length || "—"} · ${
                  liveUpdatedAt
                    ? liveUpdatedAt.toLocaleTimeString("uk-UA", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "підключення"
                }`}
          </span>
        </div>
      </div>
    </section>
  );
}
