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
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const metroLayerRef = useRef<L.LayerGroup | null>(null);
  const planLayerRef = useRef<L.LayerGroup | null>(null);
  const vehicleLayerRef = useRef<L.LayerGroup | null>(null);
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
    mapRef.current = map;
    routeLayerRef.current = L.layerGroup().addTo(map);
    metroLayerRef.current = L.layerGroup().addTo(map);
    planLayerRef.current = L.layerGroup().addTo(map);
    vehicleLayerRef.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      mapRef.current = null;
      routeLayerRef.current = null;
      metroLayerRef.current = null;
      planLayerRef.current = null;
      vehicleLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = routeLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (selectedRoute === null) return;

    const route = data.routes[selectedRoute];
    const stopIndexes = new Set<number>();
    for (const [from, to, routeIndex] of data.edges) {
      if (routeIndex !== selectedRoute) continue;
      const fromStop = data.stops[from];
      const toStop = data.stops[to];
      L.polyline(
        [
          [fromStop[2], fromStop[3]],
          [toStop[2], toStop[3]],
        ],
        {
          color: `#${route[4]}`,
          weight: 7,
          opacity: 0.82,
          lineCap: "round",
        },
      ).addTo(layer);
      stopIndexes.add(from);
      stopIndexes.add(to);
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
        .addTo(layer);
    }
  }, [data, selectedRoute]);

  useEffect(() => {
    const layer = metroLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!selectedMetroLine) return;

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
    }).addTo(layer);
    stations.forEach((station) => {
      L.circleMarker([station.lat, station.lon], {
        radius: 5,
        color: "#fff",
        weight: 2,
        fillColor: LINE_META[selectedMetroLine].color,
        fillOpacity: 1,
      })
        .bindTooltip(station.name, { direction: "top" })
        .addTo(layer);
    });
  }, [selectedMetroLine]);

  useEffect(() => {
    const layer = planLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!activePlan) return;

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
        .addTo(layer);
    });
    L.marker([activePlan.from.lat, activePlan.from.lon], {
      icon: pointIcon("A", "is-start"),
    })
      .bindTooltip(activePlan.from.name, { direction: "top" })
      .addTo(layer);
    L.marker([activePlan.to.lat, activePlan.to.lon], {
      icon: pointIcon("Б", "is-finish"),
    })
      .bindTooltip(activePlan.to.name, { direction: "top" })
      .addTo(layer);
  }, [activePlan]);

  useEffect(() => {
    const layer = vehicleLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

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
      }).addTo(layer);
    });
  }, [activePlan, data, routeVehicleIds, vehicles]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const bounds: LatLngExpression[] = [];

    if (activePlan) {
      bounds.push(
        ...activePlan.legs.flatMap((leg) =>
          leg.path.map(
            (place) => [place.lat, place.lon] as LatLngExpression,
          ),
        ),
      );
    } else if (selectedMetroLine) {
      bounds.push(
        ...LINE_STATIONS[selectedMetroLine].map(
          (station) => [station.lat, station.lon] as LatLngExpression,
        ),
      );
    } else if (selectedRoute !== null) {
      for (const [from, to, routeIndex] of data.edges) {
        if (routeIndex !== selectedRoute) continue;
        const fromStop = data.stops[from];
        const toStop = data.stops[to];
        bounds.push(
          [fromStop[2], fromStop[3]],
          [toStop[2], toStop[3]],
        );
      }
    }

    const fitKey = activePlan
      ? `plan:${activePlan.from.lat}:${activePlan.to.lat}:${activePlan.totalMinutes}`
      : selectedMetroLine
        ? `metro:${selectedMetroLine}`
        : selectedRoute !== null
          ? `route:${selectedRoute}`
          : showRegion
            ? "region"
            : "kyiv";
    if (fitKey === lastFitKey.current) return;
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
  }, [activePlan, data, selectedMetroLine, selectedRoute, showRegion]);

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
