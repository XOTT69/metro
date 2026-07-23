"use client";

import { useEffect, useMemo, useRef } from "react";
import L, { type LatLngExpression, type Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LiveVehicle } from "./gtfs-realtime";
import { LINE_META, LINE_STATIONS, type LineId } from "./metro-data";
import type { TransitNetworkData, TransitPlan } from "./transit-router";

const KYIV_CENTER: LatLngExpression = [50.4501, 30.5234];
const KYIV_REGION_BOUNDS = L.latLngBounds(
  [49.72, 29.65],
  [51.45, 32.25],
);
type VehicleMode = "bus" | "trolleybus" | "tram";

function vehicleMode(routeId: string) {
  if (routeId.startsWith("1_")) return "tram";
  if (routeId.startsWith("2_")) return "trolleybus";
  return "bus";
}

function pointIcon(label: string, className: string) {
  return L.divIcon({
    className: "transit-map-div-icon",
    html: `<span class="transit-map-point ${className}"><b>${label}</b></span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function safeText(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character];
  });
}

function vehicleIcon(
  label: string,
  mode: VehicleMode,
  bearing: number,
) {
  return L.divIcon({
    className: "transit-vehicle-div-icon",
    html: `<span class="transit-vehicle-marker is-${mode}" style="--bearing:${Math.round(
      bearing || 0,
    )}deg"><b>${safeText(label)}</b><i></i></span>`,
    iconSize: [40, 44],
    iconAnchor: [20, 22],
  });
}

export default function TransitMap({
  data,
  vehicles,
  activePlan,
  selectedRoute,
  selectedMetroLine,
  onLocate,
  onMapPoint,
  showRegion,
  pickingPoint,
}: {
  data: TransitNetworkData;
  vehicles: LiveVehicle[];
  activePlan: TransitPlan | null;
  selectedRoute: number | null;
  selectedMetroLine: LineId | null;
  onLocate: () => void;
  onMapPoint: (latitude: number, longitude: number) => void;
  showRegion: boolean;
  pickingPoint: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const overlayRef = useRef<L.LayerGroup | null>(null);
  const lastFitKey = useRef("");
  const onMapPointRef = useRef(onMapPoint);
  const pickingPointRef = useRef(pickingPoint);

  onMapPointRef.current = onMapPoint;
  pickingPointRef.current = pickingPoint;

  const routeVehicleIds = useMemo(() => {
    if (selectedRoute === null) return null;
    return new Set([data.routes[selectedRoute][0]]);
  }, [data, selectedRoute]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: KYIV_CENTER,
      zoom: 10,
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true,
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    map.attributionControl.setPrefix(false);
    map.on("click", ({ latlng }) => {
      if (pickingPointRef.current) {
        onMapPointRef.current(latlng.lat, latlng.lng);
      }
    });
    const overlay = L.layerGroup().addTo(map);
    mapRef.current = map;
    overlayRef.current = overlay;
    return () => {
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const overlay = overlayRef.current;
    if (!map || !overlay) return;
    overlay.clearLayers();
    const bounds: LatLngExpression[] = [];

    if (selectedRoute !== null) {
      const route = data.routes[selectedRoute];
      for (const [from, to, routeIndex] of data.edges) {
        if (routeIndex !== selectedRoute) continue;
        const fromStop = data.stops[from];
        const toStop = data.stops[to];
        const points: LatLngExpression[] = [
          [fromStop[2], fromStop[3]],
          [toStop[2], toStop[3]],
        ];
        L.polyline(points, {
          color: `#${route[4]}`,
          weight: 7,
          opacity: 0.82,
          lineCap: "round",
        }).addTo(overlay);
        bounds.push(...points);
      }
      const stopIndexes = new Set<number>();
      for (const [from, to, routeIndex] of data.edges) {
        if (routeIndex === selectedRoute) {
          stopIndexes.add(from);
          stopIndexes.add(to);
        }
      }
      for (const index of stopIndexes) {
        const stop = data.stops[index];
        L.circleMarker([stop[2], stop[3]], {
          radius: 4,
          color: "#fff",
          weight: 2,
          fillColor: `#${route[4]}`,
          fillOpacity: 1,
        })
          .bindTooltip(stop[1], { direction: "top" })
          .addTo(overlay);
      }
    }

    if (selectedMetroLine) {
      const stations = LINE_STATIONS[selectedMetroLine];
      const points = stations.map(
        (station) => [station.lat, station.lon] as LatLngExpression,
      );
      L.polyline(points, {
        color: LINE_META[selectedMetroLine].color,
        weight: 8,
        opacity: 0.92,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(overlay);
      stations.forEach((station) => {
        L.circleMarker([station.lat, station.lon], {
          radius: 5,
          color: "#fff",
          weight: 2,
          fillColor: LINE_META[selectedMetroLine].color,
          fillOpacity: 1,
        })
          .bindTooltip(station.name, { direction: "top" })
          .addTo(overlay);
      });
      bounds.push(...points);
    }

    if (activePlan) {
      activePlan.legs.forEach((leg) => {
        const points = leg.path.map(
          (place) => [place.lat, place.lon] as LatLngExpression,
        );
        if (points.length < 2) return;
        L.polyline(points, {
          color: leg.route?.color || "#64706b",
          weight: leg.mode === "walk" ? 5 : 8,
          opacity: 0.94,
          dashArray: leg.mode === "walk" ? "4 10" : undefined,
          lineCap: "round",
          lineJoin: "round",
        })
          .bindTooltip(
            leg.route ? `${leg.route.short} · ${leg.route.long}` : "Пішки",
            { sticky: true },
          )
          .addTo(overlay);
        bounds.push(...points);
      });
      L.marker([activePlan.from.lat, activePlan.from.lon], {
        icon: pointIcon("A", "is-start"),
      })
        .bindTooltip(activePlan.from.name, { direction: "top" })
        .addTo(overlay);
      L.marker([activePlan.to.lat, activePlan.to.lon], {
        icon: pointIcon("Б", "is-finish"),
      })
        .bindTooltip(activePlan.to.name, { direction: "top" })
        .addTo(overlay);
    }

    const planVehicleIds = activePlan
      ? new Set(
          activePlan.legs
            .map((leg) => leg.route?.id)
            .filter((routeId): routeId is string => Boolean(routeId)),
        )
      : null;
    const requestedVehicleIds = routeVehicleIds || planVehicleIds;
    const visibleVehicles = (
      requestedVehicleIds
        ? vehicles.filter((vehicle) => requestedVehicleIds.has(vehicle.routeId))
        : vehicles
    ).slice(0, requestedVehicleIds ? undefined : 190);
    const routeNames = new Map(
      data.routes.map((route) => [route[0], route[1]]),
    );
    visibleVehicles.forEach((vehicle) => {
      const mode = vehicleMode(vehicle.routeId);
      const label =
        routeNames.get(vehicle.routeId) || vehicle.label || vehicle.routeId;
      L.marker([vehicle.latitude, vehicle.longitude], {
        icon: vehicleIcon(label, mode, vehicle.bearing),
        interactive: false,
        keyboard: false,
      })
        .addTo(overlay);
    });

    const fitKey = activePlan
      ? `plan:${activePlan.from.lat}:${activePlan.to.lat}:${activePlan.totalMinutes}`
      : selectedMetroLine
        ? `metro:${selectedMetroLine}`
      : selectedRoute !== null
        ? `route:${selectedRoute}`
        : showRegion
          ? "region"
          : "kyiv";
    if (fitKey !== lastFitKey.current) {
      lastFitKey.current = fitKey;
      if (bounds.length) {
        map.fitBounds(L.latLngBounds(bounds), {
          paddingTopLeft: [45, 150],
          paddingBottomRight: [45, 150],
          maxZoom: 15,
        });
      } else if (showRegion) {
        map.fitBounds(KYIV_REGION_BOUNDS, { padding: [20, 20] });
      } else {
        map.setView(KYIV_CENTER, 10);
      }
    }
  }, [
    activePlan,
    data,
    routeVehicleIds,
    selectedMetroLine,
    selectedRoute,
    showRegion,
    vehicles,
  ]);

  const resetView = () => {
    lastFitKey.current = "";
    if (activePlan) {
      const points = activePlan.legs.flatMap((leg) =>
        leg.path.map((place) => [place.lat, place.lon] as LatLngExpression),
      );
      if (points.length) {
        mapRef.current?.fitBounds(L.latLngBounds(points), {
          padding: [55, 55],
          maxZoom: 15,
        });
        return;
      }
    }
    if (showRegion) {
      mapRef.current?.fitBounds(KYIV_REGION_BOUNDS, { padding: [20, 20] });
    } else {
      mapRef.current?.setView(KYIV_CENTER, 10);
    }
  };

  return (
    <div
      className={`transit-map-shell ${pickingPoint ? "is-picking-point" : ""}`}
    >
      <div ref={containerRef} className="transit-leaflet-map" />
      <div className="transit-map-actions">
        <button type="button" onClick={onLocate} aria-label="Знайти мене">
          ⦿
        </button>
        <button type="button" onClick={resetView} aria-label="Показати весь маршрут">
          ◫
        </button>
      </div>
      {pickingPoint && (
        <div className="transit-map-hint">
          Торкніться карти, щоб поставити точку
        </div>
      )}
      {!navigator.onLine && (
        <div className="transit-map-offline">
          Карта вулиць потребує інтернету, але збережені маршрути доступні.
        </div>
      )}
    </div>
  );
}
