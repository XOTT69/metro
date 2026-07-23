"use client";

import { useEffect, useMemo, useState } from "react";
import TransitMap from "./TransitMap";
import { decodeGtfsRealtime, type LiveVehicle } from "./gtfs-realtime";
import { LINE_META, LINE_STATIONS, type LineId } from "./metro-data";
import {
  findTransitPlansBetweenPoints,
  getTransitPlaces,
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

type PanelTab = "route" | "transport" | "alerts";
type CatalogMode = "all" | "metro" | "bus" | "trolleybus" | "tram";

const MODE_ICON: Record<TransitMode, string> = {
  metro: "M",
  bus: "A",
  trolleybus: "Т",
  tram: "Тр",
  walk: "↟",
};

const MODE_COLOR: Record<TransitMode, string> = {
  metro: "#17875f",
  bus: "#f09b18",
  trolleybus: "#2877d5",
  tram: "#e64b39",
  walk: "#66736e",
};

const geocodeCache = new Map<string, AddressResult[]>();

function vehicleMode(routeId: string): Exclude<TransitMode, "metro" | "walk"> {
  if (routeId.startsWith("1_")) return "tram";
  if (routeId.startsWith("2_")) return "trolleybus";
  return "bus";
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
      if (!next.length) onError("У межах Києва такої адреси не знайдено");
    } catch {
      onError("Пошук адрес тимчасово недоступний");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="address-field">
      <span className={`address-marker is-${marker.toLocaleLowerCase()}`}>{marker}</span>
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
        <button type="submit" aria-label={`Знайти: ${label}`} disabled={loading}>
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
          <p>Пошук OpenStreetMap · запускається лише після натискання</p>
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
      {!plan.legs.some((leg) => leg.route) && <span className="is-walk">Пішки</span>}
    </div>
  );
}

function PlanDetails({ plan }: { plan: TransitPlan }) {
  return (
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
                ? `${transitModeLabel(leg.mode)} · маршрут ${leg.route.short}`
                : "Піша ділянка"}
            </small>
            <strong>
              {leg.from.name} <i>→</i> {leg.to.name}
            </strong>
            <span>
              ≈ {Math.max(1, Math.round((leg.seconds + leg.waitSeconds) / 60))} хв
              {leg.route ? ` · ${leg.stops} зуп.` : ""}
            </span>
          </div>
        </li>
      ))}
    </ol>
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
  const [activePlanIndex, setActivePlanIndex] = useState(0);
  const [panelTab, setPanelTab] = useState<PanelTab>("route");
  const [panelOpen, setPanelOpen] = useState(true);
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

  useEffect(() => {
    fetch("/transit-network.json")
      .then((response) => {
        if (!response.ok) throw new Error("network");
        return response.json();
      })
      .then((network: TransitNetworkData) => {
        setData(network);
        const places = getTransitPlaces(network);
        const from =
          places.find((place) => place.id === "metro:akademmistechko") || places[0];
        const to =
          places.find((place) => place.id === "metro:kontraktova-ploshcha") || places[1];
        setFromPoint({
          id: `point:${from.id}`,
          name: from.name,
          detail: from.detail,
          lat: from.lat,
          lon: from.lon,
        });
        setToPoint({
          id: `point:${to.id}`,
          name: to.name,
          detail: to.detail,
          lat: to.lat,
          lon: to.lon,
        });
      })
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
          const timestamp = Math.max(...nextVehicles.map((vehicle) => vehicle.timestamp), 0);
          setLiveUpdatedAt(timestamp ? new Date(timestamp * 1000) : new Date());
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
          const saved = localStorage.getItem("metro-kyiv:last-transport-alert");
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
          if (latest) localStorage.setItem("metro-kyiv:last-transport-alert", latest.id);
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
    if (!data) return [];
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
        `${route[1]} ${route[2]}`.toLocaleLowerCase("uk-UA").includes(
          routeQuery.toLocaleLowerCase("uk-UA").trim(),
        ),
      )
      .sort((a, b) => collator.compare(a.route[1], b.route[1]));
  }, [data, routeMode, routeQuery]);

  const counts = useMemo(() => {
    const result = { bus: 0, trolleybus: 0, tram: 0 };
    vehicles.forEach((vehicle) => {
      result[vehicleMode(vehicle.routeId)] += 1;
    });
    return result;
  }, [vehicles]);

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
        setPanelTab("route");
        showToast("Початок маршруту встановлено");
      },
      () => showToast("Не вдалося отримати геопозицію"),
      { enableHighAccuracy: true, timeout: 10_000 },
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
    const periodicRegistration = registration as ServiceWorkerRegistration & {
      periodicSync?: {
        register: (tag: string, options: { minInterval: number }) => Promise<void>;
      };
    };
    await periodicRegistration?.periodicSync
      ?.register("transport-alerts", { minInterval: 15 * 60 * 1000 })
      .catch(() => undefined);
    showToast("Сповіщення про транспорт увімкнено");
  };

  if (loadError) {
    return (
      <section className="city-view">
        <div className="empty-state">
          Не вдалося завантажити транспортну мережу. Метро продовжує працювати
          офлайн.
        </div>
      </section>
    );
  }

  if (!data || !fromPoint || !toPoint) {
    return (
      <section className="city-view">
        <div className="city-loading">
          <span />
          Готуємо карту й 158 маршрутів Києва…
        </div>
      </section>
    );
  }

  const selectedRouteMeta =
    selectedRoute !== null ? data.routes[selectedRoute] : null;
  const selectedRouteVehicles = selectedRouteMeta
    ? vehicles.filter((vehicle) => vehicle.routeId === selectedRouteMeta[0])
    : [];

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
        />

        <header className="city-searchbar">
          <div className="city-searchbar__title">
            <span>Навігатор Києвом</span>
            <strong>Куди їдемо?</strong>
          </div>
          <div className="city-addresses">
            <AddressField
              marker="A"
              label="Звідки"
              point={fromPoint}
              placeholder="Введіть адресу або місце"
              onSelect={(point) => {
                setFromPoint(point);
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
              ⇄
            </button>
            <AddressField
              marker="Б"
              label="Куди"
              point={toPoint}
              placeholder="Введіть адресу призначення"
              onSelect={(point) => {
                setToPoint(point);
                setPanelTab("route");
                setPanelOpen(true);
              }}
              onError={showToast}
            />
          </div>
          <button type="button" className="city-use-location" onClick={locate}>
            ◎ <span>Моє місце</span>
          </button>
        </header>

        <button
          type="button"
          className="city-panel-toggle"
          onClick={() => setPanelOpen((value) => !value)}
        >
          {panelOpen ? "×" : "☰"}
          <span>{panelOpen ? "Закрити" : "Меню"}</span>
        </button>

        <aside className={`city-sidepanel ${panelOpen ? "is-open" : ""}`}>
          <div className="city-panel-tabs" role="tablist">
            {(
              [
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
                onClick={() => {
                  setPanelTab(tab);
                  if (tab !== "transport") {
                    setSelectedRoute(null);
                    setSelectedMetroLine(null);
                  }
                }}
                key={tab}
              >
                {label}
                {tab === "alerts" && alerts.length > 0 && <i>{alerts.length}</i>}
              </button>
            ))}
          </div>

          <div className="city-panel-content">
            {panelTab === "route" && (
              <div className="route-results-panel">
                <div className="panel-heading">
                  <div>
                    <small>Знайдено варіантів</small>
                    <strong>{plans.length || "—"}</strong>
                  </div>
                  <span>
                    {liveError ? "без live-даних" : `${vehicles.length} машин наживо`}
                  </span>
                </div>
                <div className="route-option-list">
                  {plans.map((plan, index) => (
                    <button
                      type="button"
                      key={`${plan.totalMinutes}-${index}`}
                      className={activePlanIndex === index ? "is-active" : ""}
                      onClick={() => setActivePlanIndex(index)}
                    >
                      <PlanServices plan={plan} />
                      <strong>{plan.totalMinutes} хв</strong>
                      <span>
                        {plan.transfers
                          ? `${plan.transfers} перес.`
                          : "без пересадок"}{" "}
                        · пішки {plan.walkMinutes} хв
                      </span>
                    </button>
                  ))}
                </div>
                {activePlan ? (
                  <>
                    <div className="active-plan-summary">
                      <div>
                        <small>Орієнтовне прибуття</small>
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
                        <small>У дорозі</small>
                        <strong>≈ {activePlan.totalMinutes} хв</strong>
                      </div>
                    </div>
                    <PlanDetails plan={activePlan} />
                    <p className="route-calculation-note">
                      Розрахунок враховує розклад, типове очікування, пересадки й
                      пішу відстань від введеної адреси.
                    </p>
                  </>
                ) : (
                  <div className="empty-state">
                    Для цих адрес маршрут не знайдено. Спробуйте сусідню адресу.
                  </div>
                )}
              </div>
            )}

            {panelTab === "transport" && (
              <div className="transport-catalog">
                <div className="panel-heading">
                  <div>
                    <small>Київпастранс</small>
                    <strong>Маршрути</strong>
                  </div>
                  <span>
                    {routeList.length +
                      (routeMode === "all" || routeMode === "metro" ? 3 : 0)}{" "}
                    доступно
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
                    ] as const
                  ).map(([mode, label, count]) => (
                    <button
                      type="button"
                      className={routeMode === mode ? "is-active" : ""}
                      onClick={() => {
                        setRouteMode(mode);
                        if (mode !== "metro" && mode !== "all") {
                          setSelectedMetroLine(null);
                        }
                      }}
                      key={mode}
                    >
                      <i
                        style={{
                          background:
                            mode === "all" ? "#17241f" : MODE_COLOR[mode],
                        }}
                      />
                      <span>{label}</span>
                      <b>{count || "—"}</b>
                    </button>
                  ))}
                </div>
                <label className="route-number-search">
                  <span>⌕</span>
                  <input
                    value={routeQuery}
                    onChange={(event) => setRouteQuery(event.target.value)}
                    placeholder="Номер або назва маршруту"
                  />
                </label>
                {(routeMode === "all" || routeMode === "metro") && (
                  <div className="metro-route-grid">
                    {(Object.keys(LINE_META) as LineId[]).map((line) => (
                      <button
                        type="button"
                        className={selectedMetroLine === line ? "is-active" : ""}
                        onClick={() => {
                          setSelectedMetroLine(line);
                          setSelectedRoute(null);
                        }}
                        key={line}
                      >
                        <span style={{ background: LINE_META[line].color }}>
                          {LINE_META[line].code}
                        </span>
                        <span>
                          <strong>{LINE_META[line].name} лінія</strong>
                          <small>{LINE_STATIONS[line].length} станцій</small>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {selectedMetroLine && (
                  <article className="selected-route-card is-metro">
                    <div>
                      <span
                        style={{ background: LINE_META[selectedMetroLine].color }}
                      >
                        {LINE_META[selectedMetroLine].code}
                      </span>
                      <div>
                        <small>Метрополітен</small>
                        <strong>
                          {LINE_STATIONS[selectedMetroLine][0].name} —{" "}
                          {LINE_STATIONS[selectedMetroLine].at(-1)!.name}
                        </strong>
                      </div>
                    </div>
                    <p>{LINE_STATIONS[selectedMetroLine].length} чинних станцій</p>
                    <button
                      type="button"
                      onClick={() => setSelectedMetroLine(null)}
                    >
                      Показати всі маршрути
                    </button>
                  </article>
                )}
                {selectedRouteMeta && (
                  <article className="selected-route-card">
                    <div>
                      <span style={{ background: `#${selectedRouteMeta[4]}` }}>
                        {selectedRouteMeta[1]}
                      </span>
                      <div>
                        <small>{transitModeLabel(selectedRouteMeta[3])}</small>
                        <strong>{selectedRouteMeta[2]}</strong>
                      </div>
                    </div>
                    <p>
                      {selectedRouteVehicles.length
                        ? `${selectedRouteVehicles.length} машин зараз на маршруті`
                        : "Живих машин зараз не видно"}
                    </p>
                    <button type="button" onClick={() => setSelectedRoute(null)}>
                      Показати всі маршрути
                    </button>
                  </article>
                )}
                <div className="route-number-grid">
                  {routeList.map(({ route, index }) => (
                    <button
                      type="button"
                      className={selectedRoute === index ? "is-active" : ""}
                      onClick={() => {
                        setSelectedRoute(index);
                        setSelectedMetroLine(null);
                      }}
                      key={route[0]}
                    >
                      <span style={{ background: `#${route[4]}` }}>{route[1]}</span>
                      <span>
                        <strong>{route[2]}</strong>
                        <small>
                          {transitModeLabel(route[3])}
                          {vehicles.some((vehicle) => vehicle.routeId === route[0])
                            ? " · наживо"
                            : ""}
                        </small>
                      </span>
                    </button>
                  ))}
                </div>
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
                      <a key={alert.id} href={alert.url} target="_blank" rel="noreferrer">
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
                    <div className="empty-state">Завантажуємо оновлення КМДА…</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>

        <div className={`city-live-pill ${liveError ? "is-error" : ""}`}>
          <i />
          <span>
            {liveError
              ? "Live тимчасово недоступний"
              : `${vehicles.length || "—"} машин · ${
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
