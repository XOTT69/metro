import type { CSSProperties } from "react";
import type { LiveVehicle } from "../gtfs-realtime";
import { LINE_META, LINE_STATIONS, type LineId } from "../metro-data";
import { transitModeLabel, type TransitNetworkData } from "../transit-router";
import { MODE_COLOR } from "./display";
import type { CatalogMode } from "./model";

export type TransitRouteListItem = {
  route: TransitNetworkData["routes"][number];
  index: number;
};

export type TransitCatalogPanelProps = {
  data: TransitNetworkData;
  routeList: TransitRouteListItem[];
  counts: { bus: number; trolleybus: number; tram: number };
  routeMode: CatalogMode;
  routeQuery: string;
  selectedRoute: number | null;
  selectedMetroLine: LineId | null;
  vehicles: LiveVehicle[];
  favoriteRoutes: string[];
  onModeChange: (mode: CatalogMode) => void;
  onQueryChange: (query: string) => void;
  onRoute: (index: number) => void;
  onMetroLine: (line: LineId) => void;
  onFavorite: (routeId: string) => void;
};

export default function TransitCatalogPanel({
  data,
  routeList,
  counts,
  routeMode,
  routeQuery,
  selectedRoute,
  selectedMetroLine,
  vehicles,
  favoriteRoutes,
  onModeChange,
  onQueryChange,
  onRoute,
  onMetroLine,
  onFavorite,
}: TransitCatalogPanelProps) {
  return (
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
            ["all", "Усі", data.routes.length],
            ["metro", "Метро", 3],
            ["bus", "Автобус", counts.bus],
            ["trolleybus", "Тролейбус", counts.trolleybus],
            ["tram", "Трамвай", counts.tram],
          ] as const
        ).map(([mode, label, count]) => (
          <button
            type="button"
            className={routeMode === mode ? "is-active" : ""}
            onClick={() => onModeChange(mode)}
            key={mode}
          >
            <i
              style={{
                background: mode === "all" ? "#192720" : MODE_COLOR[mode],
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
            onChange={(event) => onQueryChange(event.target.value)}
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
              onClick={() => onMetroLine(line)}
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
              <button type="button" onClick={() => onRoute(index)}>
                <span>{route[1]}</span>
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
              <button
                type="button"
                onClick={() => onFavorite(route[0])}
                aria-label="Додати маршрут в обране"
              >
                {favoriteRoutes.includes(route[0]) ? "★" : "☆"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
