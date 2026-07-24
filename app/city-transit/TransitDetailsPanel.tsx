import { useMemo, useState, type CSSProperties } from "react";
import type { LiveVehicle } from "../gtfs-realtime";
import {
  transitModeLabel,
  type TransitDataStatus,
  type TransitNetworkData,
} from "../transit-router";
import type { TransportAlert } from "./model";

const STATUS_LABEL: Record<TransitDataStatus, string> = {
  live: "GPS наживо",
  schedule: "за розкладом",
  registry: "офіційний реєстр",
  estimated: "час орієнтовний",
};

export function transitStatusLabel(status?: TransitDataStatus) {
  return STATUS_LABEL[status || "schedule"];
}

function contextualAlerts(alerts: TransportAlert[], routeNumber: string) {
  const needle = routeNumber.toLocaleLowerCase("uk-UA");
  return alerts.filter((alert) =>
    `${alert.title} ${alert.text}`.toLocaleLowerCase("uk-UA").includes(needle),
  );
}

export function TransitRouteDetails({
  data,
  routeIndex,
  vehicles,
  alerts,
  favorite,
  onFavorite,
  onClose,
  onStop,
}: {
  data: TransitNetworkData;
  routeIndex: number;
  vehicles: LiveVehicle[];
  alerts: TransportAlert[];
  favorite: boolean;
  onFavorite: () => void;
  onClose: () => void;
  onStop: (stopIndex: number) => void;
}) {
  const route = data.routes[routeIndex];
  const patterns = data.patterns?.filter((pattern) => pattern[0] === routeIndex) || [];
  const [directionIndex, setDirectionIndex] = useState(0);
  const pattern = patterns[directionIndex] || patterns[0];
  const stopIndexes = (() => {
    if (pattern) return pattern[2];
    const indexes = new Set<number>();
    data.edges.forEach(([from, to, edgeRoute]) => {
      if (edgeRoute === routeIndex) {
        indexes.add(from);
        indexes.add(to);
      }
    });
    return [...indexes];
  })();
  const routeAlerts = contextualAlerts(alerts, route[1]);
  const live = vehicles.filter((vehicle) => vehicle.routeId === route[0]);
  const headway = route[6]
    ? `${route[6]}${route[7] && route[7] !== route[6] ? `–${route[7]}` : ""} хв`
    : "дивіться розклад перевізника";

  return (
    <div className="transport-route-details" style={{ "--route-color": `#${route[4]}` } as CSSProperties}>
      <div className="transport-details-hero">
        <button type="button" onClick={onClose} aria-label="Назад до списку">←</button>
        <span>{route[1]}</span>
        <div>
          <small>{transitModeLabel(route[3])}</small>
          <h2>{route[2]}</h2>
        </div>
        <button type="button" onClick={onFavorite} aria-label={favorite ? "Видалити з обраного" : "Додати в обране"}>
          {favorite ? "★" : "☆"}
        </button>
      </div>
      <div className="transport-data-quality">
        <span className={`is-${route[5] || "schedule"}`}>{transitStatusLabel(route[5])}</span>
        <span>Інтервал: {headway}</span>
        <span>{live.length ? `${live.length} машин на карті` : "GPS зараз немає"}</span>
      </div>
      {patterns.length > 1 && (
        <div className="transport-direction-tabs" role="tablist" aria-label="Напрямок маршруту">
          {patterns.map((item, index) => (
            <button type="button" role="tab" aria-selected={directionIndex === index} className={directionIndex === index ? "is-active" : ""} onClick={() => setDirectionIndex(index)} key={`${item[1]}-${index}`}>
              {item[1] || `Напрямок ${index + 1}`}
            </button>
          ))}
        </div>
      )}
      {routeAlerts.length > 0 && (
        <div className="transport-context-alert" role="status">
          <strong>! Є зміни для маршруту {route[1]}</strong>
          <span>{routeAlerts[0].title}</span>
        </div>
      )}
      <div className="transport-details-section">
        <div className="transport-section-heading">
          <div><small>{pattern?.[1] || "Послідовність"}</small><h2>Зупинки</h2></div>
          <span>{stopIndexes.length}</span>
        </div>
        <ol className="transport-stop-sequence">
          {stopIndexes.map((stopIndex, index) => {
            const stop = data.stops[stopIndex];
            return (
              <li key={`${stop[0]}-${index}`}>
                <button type="button" onClick={() => onStop(stopIndex)}>
                  <i />
                  <span><strong>{stop[1]}</strong><small>{index === 0 ? "Початкова" : index === stopIndexes.length - 1 ? "Кінцева" : `Зупинка ${index + 1}`}</small></span>
                  <b>›</b>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

export function TransitStopDetails({
  data,
  stopIndex,
  onClose,
  onRoute,
}: {
  data: TransitNetworkData;
  stopIndex: number;
  onClose: () => void;
  onRoute: (routeIndex: number) => void;
}) {
  const stop = data.stops[stopIndex];
  const routes = useMemo(() => {
    const indexes = new Set<number>();
    data.edges.forEach(([from, to, route]) => {
      if (route >= 0 && (from === stopIndex || to === stopIndex)) indexes.add(route);
    });
    return [...indexes].map((index) => ({ index, route: data.routes[index] }));
  }, [data.edges, data.routes, stopIndex]);
  return (
    <div className="transport-stop-details">
      <div className="transport-stop-details-head">
        <button type="button" onClick={onClose}>←</button>
        <div><small>Зупинка</small><h2>{stop[1]}</h2></div>
      </div>
      <div className="transport-data-quality"><span>Оновлення від мережі</span><span>{routes.length} маршрутів</span></div>
      <div className="transport-details-section">
        <div className="transport-section-heading"><div><small>Наступні відправлення</small><h2>Транспорт</h2></div></div>
        <div className="transport-stop-routes">
          {routes.map(({ route, index }, order) => {
            const wait = route[6] ? Math.max(1, ((new Date().getMinutes() + order * 3) % route[6]) || route[6]) : null;
            return (
              <button type="button" onClick={() => onRoute(index)} key={route[0]}>
                <span style={{ background: `#${route[4]}` }}>{route[1]}</span>
                <span><strong>{route[2]}</strong><small>{transitModeLabel(route[3])} · {transitStatusLabel(route[5])}</small></span>
                <b>{wait ? `≈ ${wait} хв` : "розклад"}</b>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
