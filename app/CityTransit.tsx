"use client";

import { useEffect, useMemo, useState } from "react";
import { decodeGtfsRealtime, type LiveVehicle } from "./gtfs-realtime";
import {
  findNearestTransitPlace,
  findTransitPlan,
  getTransitPlaces,
  transitModeLabel,
  type TransitMode,
  type TransitNetworkData,
  type TransitPlace,
  type TransitPlan,
} from "./transit-router";
import { usePinchPanZoom } from "./use-pinch-pan-zoom";

type TransportAlert = {
  id: string;
  title: string;
  text: string;
  publishedAt: string;
  url: string;
  source: string;
};

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
  walk: "#7a8580",
};

function vehicleMode(routeId: string): Exclude<TransitMode, "metro" | "walk"> {
  if (routeId.startsWith("1_")) return "tram";
  if (routeId.startsWith("2_")) return "trolleybus";
  return "bus";
}

function TransitPicker({
  label,
  value,
  places,
  onChange,
}: {
  label: string;
  value: number;
  places: TransitPlace[];
  onChange: (node: number) => void;
}) {
  return (
    <label className="city-picker">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(Number(event.target.value))}>
        <optgroup label="Метро">
          {places
            .filter((place) => place.mode === "metro")
            .map((place) => (
              <option key={place.id} value={place.node}>
                {place.name} · {place.detail}
              </option>
            ))}
        </optgroup>
        <optgroup label="Автобуси, тролейбуси та трамваї">
          {places
            .filter((place) => place.mode !== "metro")
            .map((place) => (
              <option key={place.id} value={place.node}>
                {place.name}
              </option>
            ))}
        </optgroup>
      </select>
    </label>
  );
}

const MAP_BOUNDS = {
  minLat: 50.28,
  maxLat: 50.62,
  minLon: 30.25,
  maxLon: 30.85,
};

function mapPoint(latitude: number, longitude: number) {
  return {
    x: ((longitude - MAP_BOUNDS.minLon) / (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon)) * 1000,
    y: ((MAP_BOUNDS.maxLat - latitude) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * 620,
  };
}

function LiveTransportMap({
  vehicles,
  plan,
}: {
  vehicles: LiveVehicle[];
  plan: TransitPlan | null;
}) {
  const [zoom, setZoom] = useState(0.72);
  const mapGesture = usePinchPanZoom(zoom, setZoom, 0.56, 1.65);
  const visible = vehicles.filter(
    (vehicle) =>
      vehicle.latitude > MAP_BOUNDS.minLat &&
      vehicle.latitude < MAP_BOUNDS.maxLat &&
      vehicle.longitude > MAP_BOUNDS.minLon &&
      vehicle.longitude < MAP_BOUNDS.maxLon,
  );
  const planPoints = plan
    ? [plan.from, ...plan.legs.map((leg) => leg.to)].map((point) =>
        mapPoint(point.lat, point.lon),
      )
    : [];

  return (
    <div className="live-map" aria-label={`На карті ${visible.length} машин`}>
      <div className="live-map__toolbar" aria-label="Керування картою">
        <button
          type="button"
          onClick={() => setZoom((value) => mapGesture.clampZoom(value - 0.12))}
          aria-label="Зменшити карту"
        >
          −
        </button>
        <b>{Math.round(zoom * 100)}%</b>
        <button
          type="button"
          onClick={() => setZoom((value) => mapGesture.clampZoom(value + 0.12))}
          aria-label="Збільшити карту"
        >
          +
        </button>
      </div>
      <div className="live-map__hint">один палець — рух · два — масштаб</div>
      <div
        className="live-map__scroll"
        ref={mapGesture.scrollRef}
        {...mapGesture.pointerHandlers}
      >
        <svg
          viewBox="0 0 1000 620"
          role="img"
          style={{ width: 1000 * zoom, height: 620 * zoom }}
        >
          <title>Живі позиції громадського транспорту і обраний маршрут</title>
          <path
            className="live-map__river"
            d="M610 -20 C560 90 625 165 590 260 C555 355 615 430 560 650 L735 650 C770 500 700 400 735 295 C770 190 690 95 735 -20 Z"
          />
          <g className="live-map__roads" aria-hidden="true">
            <path d="M55 520 C250 420 390 505 570 385 S840 205 960 105" />
            <path d="M95 115 C260 180 355 245 530 265 S790 355 955 520" />
            <path d="M350 35 C385 170 310 295 405 430 S520 550 545 610" />
            <path d="M760 20 C790 170 730 290 795 425 S900 545 930 610" />
          </g>
          <g className="live-map__labels" aria-hidden="true">
            <text x="42" y="52">Київ · транспорт наживо</text>
            <text x="645" y="55">Дніпро</text>
          </g>
          {planPoints.length > 1 && (
            <g className="city-active-route">
              <polyline
                className="city-active-route__halo"
                points={planPoints.map((point) => `${point.x},${point.y}`).join(" ")}
              />
              {plan!.legs.map((leg) => {
                const from = mapPoint(leg.from.lat, leg.from.lon);
                const to = mapPoint(leg.to.lat, leg.to.lon);
                return (
                  <line
                    key={`${leg.from.id}-${leg.to.id}-${leg.route?.id || "walk"}`}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={leg.route?.color || MODE_COLOR.walk}
                    className={leg.mode === "walk" ? "is-walk" : ""}
                  >
                    <title>
                      {leg.route
                        ? `${transitModeLabel(leg.mode)} ${leg.route.short}`
                        : "Піша пересадка"}
                    </title>
                  </line>
                );
              })}
              {planPoints.map((point, index) => (
                <circle
                  key={`${point.x}-${point.y}-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r={index === 0 || index === planPoints.length - 1 ? 10 : 6}
                  className={
                    index === 0
                      ? "city-route-point is-start"
                      : index === planPoints.length - 1
                        ? "city-route-point is-finish"
                        : "city-route-point"
                  }
                />
              ))}
            </g>
          )}
          {visible.map((vehicle) => {
            const mode = vehicleMode(vehicle.routeId);
            const { x, y } = mapPoint(vehicle.latitude, vehicle.longitude);
            return (
              <circle
                key={vehicle.id}
                cx={x}
                cy={y}
                r="5"
                fill={MODE_COLOR[mode]}
                className="live-vehicle-dot"
              >
                <title>
                  {transitModeLabel(mode)} {vehicle.label || vehicle.routeId}
                </title>
              </circle>
            );
          })}
        </svg>
      </div>
      <div className="live-map__legend">
        {(["bus", "trolleybus", "tram"] as const).map((mode) => (
          <span key={mode}>
            <i style={{ background: MODE_COLOR[mode] }} />
            {transitModeLabel(mode)}
          </span>
        ))}
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
  const [fromNode, setFromNode] = useState(0);
  const [toNode, setToNode] = useState(0);
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
        setFromNode(
          places.find((place) => place.id === "metro:akademmistechko")?.node ??
            places[0].node,
        );
        setToNode(
          places.find((place) => place.id === "metro:kontraktova-ploshcha")?.node ??
            places[1].node,
        );
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
          const sourceTimestamp = Math.max(...nextVehicles.map((vehicle) => vehicle.timestamp), 0);
          setLiveUpdatedAt(sourceTimestamp ? new Date(sourceTimestamp * 1000) : new Date());
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

  const places = useMemo(() => (data ? getTransitPlaces(data) : []), [data]);
  const plan = useMemo(
    () => (data && fromNode !== toNode ? findTransitPlan(data, fromNode, toNode) : null),
    [data, fromNode, toNode],
  );
  const counts = useMemo(() => {
    const result = { bus: 0, trolleybus: 0, tram: 0 };
    for (const vehicle of vehicles) result[vehicleMode(vehicle.routeId)] += 1;
    return result;
  }, [vehicles]);

  const findNearest = () => {
    if (!data || !navigator.geolocation) {
      showToast("Геолокація недоступна");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const place = findNearestTransitPlace(data, coords.latitude, coords.longitude);
        setFromNode(place.node);
        showToast(`Найближче: ${place.name}`);
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
          Не вдалося завантажити транспортну мережу. Метро продовжує працювати офлайн.
        </div>
      </section>
    );
  }

  if (!data || !places.length) {
    return (
      <section className="city-view">
        <div className="city-loading">
          <span />
          Завантажуємо 158 маршрутів Києва…
        </div>
      </section>
    );
  }

  return (
    <section className="city-view">
      <div className="city-hero">
        <div>
          <span className="eyebrow-label">Метро + наземний транспорт</span>
          <h1>Увесь Київ одним маршрутом</h1>
          <p>
            Офіційні розклади Київпастрансу, 1447 зупинок, метро та піші пересадки —
            в одному офлайн-планувальнику.
          </p>
        </div>
        <div className="city-network-stats">
          <div><strong>158</strong><span>маршрутів</span></div>
          <div><strong>1447</strong><span>зупинок</span></div>
          <div><strong>{vehicles.length || "—"}</strong><span>зараз на лінії</span></div>
        </div>
      </div>

      <div className="city-layout">
        <div className="city-planner">
          <div className="city-planner__title">
            <div>
              <span>Побудова поїздки</span>
              <strong>Зі зручними пересадками</strong>
            </div>
            <button type="button" onClick={findNearest}>◎ Я тут</button>
          </div>
          <div className="city-route-form">
            <TransitPicker label="Звідки" value={fromNode} places={places} onChange={setFromNode} />
            <button
              type="button"
              className="city-swap"
              onClick={() => {
                setFromNode(toNode);
                setToNode(fromNode);
              }}
              aria-label="Поміняти початок і кінець маршруту"
            >
              ⇅
            </button>
            <TransitPicker label="Куди" value={toNode} places={places} onChange={setToNode} />
          </div>

          {plan ? (
            <>
              <div className="city-plan-summary">
                <div><small>У дорозі</small><strong>≈ {plan.totalMinutes} хв</strong></div>
                <div><small>Пересадки</small><strong>{plan.transfers}</strong></div>
                <div><small>Пішки</small><strong>{plan.walkMinutes} хв</strong></div>
              </div>
              <ol className="city-legs">
                {plan.legs.map((leg, index) => (
                  <li key={`${leg.from.id}-${leg.to.id}-${index}`}>
                    <span
                      className="transport-mode"
                      style={{ background: leg.route?.color || MODE_COLOR.walk }}
                    >
                      {leg.route?.short || MODE_ICON.walk}
                    </span>
                    <div>
                      <small>
                        {leg.route
                          ? `${transitModeLabel(leg.mode)} ${leg.route.short}`
                          : "Пішки до пересадки"}
                      </small>
                      <strong>{leg.from.name} → {leg.to.name}</strong>
                      <span>
                        {Math.max(1, Math.round((leg.seconds + leg.waitSeconds) / 60))} хв
                        {leg.route ? ` · ${leg.stops} зуп.` : ""}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="city-plan-note">
                Час враховує типовий інтервал очікування. Живі позиції показані
                окремо й поки не змінюють розрахунок маршруту.
              </p>
            </>
          ) : (
            <div className="empty-state">Оберіть різні точки маршруту.</div>
          )}
        </div>

        <section className="live-transport">
          <div className="live-transport__head">
            <div>
              <span className={`live-status ${liveError ? "is-offline" : ""}`}>
                <i /> {liveError ? "тимчасово недоступно" : "наживо"}
              </span>
              <h2>Транспорт на лінії</h2>
            </div>
            <small>
              {liveUpdatedAt
                ? `оновлено ${liveUpdatedAt.toLocaleTimeString("uk-UA", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : "підключення…"}
            </small>
          </div>
          <div className="vehicle-counts">
            <span><b>{counts.bus || "—"}</b> автобусів</span>
            <span><b>{counts.trolleybus || "—"}</b> тролейбусів</span>
            <span><b>{counts.tram || "—"}</b> трамваїв</span>
          </div>
          <LiveTransportMap vehicles={vehicles} plan={plan} />
          <p className="live-source">
            GPS · офіційні відкриті дані Києва · оновлення кожні 30 с · карту можна
            рухати та масштабувати пальцями
          </p>
        </section>
      </div>

      <section className="transport-alerts">
        <div className="transport-alerts__head">
          <div>
            <span className="eyebrow-label">Оперативні зміни КМДА</span>
            <h2>Транспортні сповіщення</h2>
            <p>Закриття станцій, затримки та тимчасові зміни маршрутів.</p>
          </div>
          <button
            type="button"
            className={alertsEnabled ? "secondary-button is-enabled" : "primary-button"}
            onClick={enableAlerts}
          >
            {alertsEnabled ? "✓ Сповіщення увімкнено" : "Увімкнути сповіщення"}
          </button>
        </div>
        <div className="alert-grid">
          {alerts.length ? (
            alerts.slice(0, 6).map((alert) => (
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
            <div className="empty-state">
              Підключаємо офіційну стрічку КМДА. Оновлення з’являться автоматично.
            </div>
          )}
        </div>
      </section>

      <p className="city-data-note">
        Розклад: GTFS Static · живі позиції: GTFS Realtime · джерело: Портал
        відкритих даних Києва. Дані приватних перевізників можуть бути неповними.
      </p>
    </section>
  );
}
