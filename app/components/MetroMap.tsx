import { useState } from "react";
import {
  LINE_META,
  LINE_STATIONS,
  STATION_BY_ID,
  STATIONS,
  TRANSFERS,
  type LineId,
} from "../metro-data";
import { usePinchPanZoom } from "../use-pinch-pan-zoom";

const LINE_IDS: LineId[] = ["red", "blue", "green"];
const TRANSFER_IDS = new Set(TRANSFERS.flat());

export default function MetroMap({
  route,
  onStation,
}: {
  route: string[];
  onStation: (id: string) => void;
}) {
  const [zoom, setZoom] = useState(0.74);
  const mapGesture = usePinchPanZoom(zoom, setZoom, 0.62, 1.8);
  const [pointedStation, setPointedStation] = useState<string | null>(null);
  const routeSet = new Set(route);
  const highlightedStation =
    STATION_BY_ID[pointedStation || route.at(-1) || route.at(0) || STATIONS[0].id];
  const segments = route.slice(1).map((id, index) => [
    STATION_BY_ID[route[index]],
    STATION_BY_ID[id],
  ]);

  return (
    <div className="map-shell">
      <div className="map-station-inspector" aria-live="polite">
        <span
          className="line-chip"
          style={{ background: LINE_META[highlightedStation.line].color }}
        >
          {LINE_META[highlightedStation.line].code}
        </span>
        <div>
          <small>Обрана станція</small>
          <strong>{highlightedStation.name}</strong>
        </div>
        <button type="button" onClick={() => onStation(highlightedStation.id)}>
          Таймер →
        </button>
      </div>
      <div className="map-toolbar" aria-label="Керування схемою">
        <span>
          <b>{Math.round(zoom * 100)}%</b>
          <small>масштаб</small>
        </span>
        <button
          type="button"
          onClick={() => setZoom((value) => mapGesture.clampZoom(value - 0.1))}
          aria-label="Зменшити масштаб"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => setZoom((value) => mapGesture.clampZoom(value + 0.1))}
          aria-label="Збільшити масштаб"
        >
          +
        </button>
        <button
          type="button"
          className="map-fit-button"
          onClick={() => setZoom(0.74)}
        >
          Вписати
        </button>
      </div>

      <div className="map-gesture-hint" aria-hidden="true">
        <span>☝</span> рух · <span>✌</span> масштаб
      </div>
      <div
        className="map-scroll map-scroll--gestures"
        ref={mapGesture.scrollRef}
        {...mapGesture.pointerHandlers}
        aria-label="Інтерактивна схема метро. Переміщуйте одним пальцем, масштабуйте двома."
      >
        <svg
          className="metro-map"
          viewBox="0 0 1400 960"
          role="img"
          style={{ width: 1400 * zoom, height: 960 * zoom }}
        >
          <title>Схема Київського метрополітену</title>
          <desc>
            Три чинні лінії, 52 станції та три пересадкові вузли. Обраний маршрут
            виділено жовтим.
          </desc>

          <path
            className="river-shape"
            d="M870 0 C820 170 865 300 860 420 C852 575 820 690 770 960 L1010 960 C1060 760 1045 595 1025 450 C1005 295 1070 155 1110 0 Z"
          />

          <g className="map-zone-labels" aria-hidden="true">
            <text x="905" y="42">правий берег</text>
            <text x="1028" y="42">Дніпро</text>
            <text x="1150" y="42">лівий берег</text>
          </g>

          <g className="network">
            {LINE_IDS.map((line) => (
              <polyline
                key={line}
                points={LINE_STATIONS[line]
                  .map(({ x, y }) => `${x},${y}`)
                  .join(" ")}
                fill="none"
                stroke={LINE_META[line].color}
                strokeWidth="15"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
          </g>

          <g className="transfer-links">
            {TRANSFERS.map(([a, b]) => (
              <g key={`${a}-${b}`}>
                <line
                  x1={STATION_BY_ID[a].x}
                  y1={STATION_BY_ID[a].y}
                  x2={STATION_BY_ID[b].x}
                  y2={STATION_BY_ID[b].y}
                  className="transfer-link transfer-link--outer"
                />
                <line
                  x1={STATION_BY_ID[a].x}
                  y1={STATION_BY_ID[a].y}
                  x2={STATION_BY_ID[b].x}
                  y2={STATION_BY_ID[b].y}
                  className="transfer-link transfer-link--inner"
                />
              </g>
            ))}
          </g>

          {!!segments.length && (
            <g className="active-route">
              {segments.map(([a, b]) => (
                <line
                  key={`${a.id}-${b.id}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  className={a.line === b.line ? "" : "is-transfer"}
                />
              ))}
            </g>
          )}

          {STATIONS.map((station) => {
            const selected = routeSet.has(station.id);
            return (
              <g
                key={station.id}
                className={`map-station ${selected ? "is-route" : ""}`}
                role="button"
                tabIndex={0}
                aria-label={`${station.name}, ${LINE_META[station.line].name} лінія`}
                onMouseEnter={() => setPointedStation(station.id)}
                onFocus={() => setPointedStation(station.id)}
                onClick={() => onStation(station.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onStation(station.id);
                  }
                }}
              >
                <circle
                  cx={station.x}
                  cy={station.y}
                  r={selected ? 10 : TRANSFER_IDS.has(station.id) ? 9 : 7}
                  fill="var(--map-bg)"
                  stroke={
                    selected
                      ? "var(--route-accent)"
                      : LINE_META[station.line].color
                  }
                  strokeWidth={selected ? 6 : 5}
                />
              </g>
            );
          })}

          {LINE_IDS.map((line) => {
            const first = LINE_STATIONS[line][0];
            const last = LINE_STATIONS[line].at(-1)!;
            return (
              <g key={line} className="line-end-markers" aria-hidden="true">
                <circle
                  cx={first.x}
                  cy={first.y}
                  r="22"
                  fill={LINE_META[line].color}
                />
                <text x={first.x} y={first.y + 5}>
                  {LINE_META[line].code}
                </text>
                <circle
                  cx={last.x}
                  cy={last.y}
                  r="22"
                  fill={LINE_META[line].color}
                />
                <text x={last.x} y={last.y + 5}>
                  {LINE_META[line].code}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
