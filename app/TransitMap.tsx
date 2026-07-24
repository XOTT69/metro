"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import {
  type GeoJSONSource,
  type Map as MapLibreMap,
  type Marker,
} from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import type {
  FeatureCollection as GeoJSONFeatureCollection,
  Geometry,
} from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import type { LiveVehicle } from "./gtfs-realtime";
import { LINE_META, LINE_STATIONS, type LineId } from "./metro-data";
import type { TransitNetworkData, TransitPlan } from "./transit-router";
import {
  filterVisibleVehicles,
  getVisibleVehicleRouteIds,
} from "./city-transit/vehicle-visibility";

const KYIV_CENTER: [number, number] = [30.5234, 50.4501];
const KYIV_REGION_BOUNDS: [[number, number], [number, number]] = [
  [29.65, 49.72],
  [32.25, 51.45],
];

function rasterStyle({
  id,
  tiles,
  attribution,
  background,
  overlay,
}: {
  id: string;
  tiles: string[];
  attribution: string;
  background: string;
  overlay?: { id: string; tiles: string[]; attribution?: string };
}): StyleSpecification {
  return {
    version: 8,
    sources: {
      [id]: { type: "raster", tiles, tileSize: 256, attribution, maxzoom: 20 },
      ...(overlay
        ? {
            [overlay.id]: {
              type: "raster" as const,
              tiles: overlay.tiles,
              tileSize: 256,
              attribution: overlay.attribution || "",
              maxzoom: 20,
            },
          }
        : {}),
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": background } },
      { id, type: "raster", source: id },
      ...(overlay ? [{ id: overlay.id, type: "raster" as const, source: overlay.id }] : []),
    ],
  };
}

const STREET_STYLE = rasterStyle({
  id: "openstreetmap",
  tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
  attribution: "© OpenStreetMap contributors",
  background: "#e7e3db",
});

const LIGHT_STYLE = rasterStyle({
  id: "carto-light",
  tiles: ["https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png"],
  attribution: "© OpenStreetMap contributors © CARTO",
  background: "#edf0ed",
});

const DARK_STYLE = rasterStyle({
  id: "carto-dark",
  tiles: ["https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png"],
  attribution: "© OpenStreetMap contributors © CARTO",
  background: "#1f2728",
});

const THREE_D_STYLE: StyleSpecification = {
  ...STREET_STYLE,
  sources: {
    ...STREET_STYLE.sources,
    buildings: { type: "vector", url: "https://tiles.openfreemap.org/planet" },
  },
  layers: [
    ...STREET_STYLE.layers,
    {
      id: "metro-kyiv-buildings",
      type: "fill-extrusion",
      source: "buildings",
      "source-layer": "building",
      minzoom: 14,
      paint: {
        "fill-extrusion-color": "#d0ccc2",
        "fill-extrusion-height": [
          "coalesce",
          ["get", "render_height"],
          ["get", "height"],
          5,
        ],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
        "fill-extrusion-opacity": 0.86,
      },
    },
  ],
};

/* Code-owned styles keep the map usable when a remote style endpoint fails. */
const SATELLITE_STYLE: StyleSpecification = rasterStyle({
  id: "satellite",
  tiles: [
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  ],
  attribution: "Esri World Imagery",
  background: "#243227",
  overlay: {
    id: "satellite-labels",
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    ],
  },
});

const MAP_STYLES = {
  streets: {
    label: "Вулиці",
    short: "Мапа",
    style: STREET_STYLE,
    pitch: 0,
  },
  light: {
    label: "Світла",
    short: "Світла",
    style: LIGHT_STYLE,
    pitch: 0,
  },
  dark: {
    label: "Темна",
    short: "Темна",
    style: DARK_STYLE,
    pitch: 0,
  },
  threeD: {
    label: "3D-будинки",
    short: "3D",
    style: THREE_D_STYLE,
    pitch: 55,
  },
  satellite: {
    label: "Супутник",
    short: "Фото",
    style: SATELLITE_STYLE,
    pitch: 0,
  },
} as const;

type MapStyleId = keyof typeof MAP_STYLES;
type VehicleMode = "bus" | "trolleybus" | "tram";
type Coordinate = [number, number];
type Properties = Record<string, string | number | boolean>;
type FeatureCollection = GeoJSONFeatureCollection<Geometry, Properties>;

function emptyCollection(): FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function lineFeature(coordinates: Coordinate[], properties: Properties) {
  return {
    type: "Feature" as const,
    properties,
    geometry: { type: "LineString" as const, coordinates },
  };
}

function pointFeature(coordinates: Coordinate, properties: Properties) {
  return {
    type: "Feature" as const,
    properties,
    geometry: { type: "Point" as const, coordinates },
  };
}

function updateSource(
  map: MapLibreMap,
  id: string,
  data: FeatureCollection,
) {
  const source = map.getSource(id) as GeoJSONSource | undefined;
  if (source) source.setData(data);
  else map.addSource(id, { type: "geojson", data });
}

function vehicleMode(routeId: string): VehicleMode {
  if (routeId.startsWith("1_")) return "tram";
  if (routeId.startsWith("2_")) return "trolleybus";
  return "bus";
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

function createVehicleElement(
  label: string,
  mode: VehicleMode,
  bearing: number,
  stale: boolean,
) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = `transit-vehicle-marker is-${mode}${
    stale ? " is-stale" : ""
  }`;
  element.style.setProperty("--bearing", `${Math.round(bearing || 0)}deg`);
  element.setAttribute("aria-label", `Маршрут ${label}`);
  element.innerHTML = `<i aria-hidden="true"><em></em></i><b>${safeText(
    label,
  )}</b>`;
  return element;
}

function routeCoordinates(data: TransitNetworkData, selectedRoute: number) {
  const patternCoordinates = data.patterns
    ?.filter((pattern) => pattern[0] === selectedRoute)
    .flatMap((pattern) => pattern[3]);
  if (patternCoordinates?.length) return patternCoordinates;
  const coordinates: Coordinate[] = [];
  for (const [from, to, routeIndex] of data.edges) {
    if (routeIndex !== selectedRoute) continue;
    const fromStop = data.stops[from];
    const toStop = data.stops[to];
    coordinates.push([fromStop[3], fromStop[2]], [toStop[3], toStop[2]]);
  }
  return coordinates;
}

function journeyLegCoordinates(
  data: TransitNetworkData,
  leg: TransitPlan["legs"][number],
) {
  if (!leg.route || leg.mode === "metro" || leg.mode === "regional") {
    return leg.path.map((place) => [place.lon, place.lat] as Coordinate);
  }
  const routeIndex = data.routes.findIndex((route) => route[0] === leg.route?.id);
  const patterns = data.patterns?.filter((pattern) => pattern[0] === routeIndex);
  if (!patterns?.length) {
    return leg.path.map((place) => [place.lon, place.lat] as Coordinate);
  }
  const closestIndex = (coordinates: Coordinate[], lon: number, lat: number) =>
    coordinates.reduce(
      (best, coordinate, index) => {
        const score = Math.hypot(coordinate[0] - lon, coordinate[1] - lat);
        return score < best.score ? { index, score } : best;
      },
      { index: 0, score: Infinity },
    );
  const candidates = patterns.map((pattern) => {
    const start = closestIndex(pattern[3], leg.from.lon, leg.from.lat);
    const finish = closestIndex(pattern[3], leg.to.lon, leg.to.lat);
    return { coordinates: pattern[3], start, finish, score: start.score + finish.score };
  });
  const best = candidates.sort((a, b) => a.score - b.score)[0];
  const [from, to] = [best.start.index, best.finish.index].sort((a, b) => a - b);
  const slice = best.coordinates.slice(from, to + 1);
  return best.start.index <= best.finish.index ? slice : slice.reverse();
}

export default function TransitMap({
  data,
  vehicles,
  activePlan,
  selectedRoute,
  selectedMetroLine,
  favoriteRouteIds,
  panelOpen,
  onLocate,
  onMapPoint,
  onStop,
  showRegion,
  pickingPoint,
}: {
  data: TransitNetworkData;
  vehicles: LiveVehicle[];
  activePlan: TransitPlan | null;
  selectedRoute: number | null;
  selectedMetroLine: LineId | null;
  favoriteRouteIds: string[];
  panelOpen: boolean;
  onLocate: () => void;
  onMapPoint: (latitude: number, longitude: number) => void;
  onStop: (stopIndex: number) => void;
  showRegion: boolean;
  pickingPoint: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const vehicleMarkersRef = useRef<Marker[]>([]);
  const lastFitKey = useRef("");
  const onMapPointRef = useRef(onMapPoint);
  const onStopRef = useRef(onStop);
  const pickingPointRef = useRef(pickingPoint);
  const initialStyleRef = useRef<MapStyleId | null>(null);
  const currentStyleRef = useRef<MapStyleId | null>(null);
  const [styleRevision, setStyleRevision] = useState(0);
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const [mapStyle, setMapStyle] = useState<MapStyleId>(() => {
    const saved = localStorage.getItem("metro-kyiv:map-style");
    return saved && saved in MAP_STYLES ? (saved as MapStyleId) : "streets";
  });
  if (!initialStyleRef.current) initialStyleRef.current = mapStyle;

  onMapPointRef.current = onMapPoint;
  onStopRef.current = onStop;
  pickingPointRef.current = pickingPoint;

  const selectedRouteId =
    selectedRoute === null ? null : data.routes[selectedRoute][0];
  const visibleVehicleRouteIds = useMemo(
    () =>
      getVisibleVehicleRouteIds({
        favoriteRouteIds,
        selectedRouteId,
        activePlan,
      }),
    [activePlan, favoriteRouteIds, selectedRouteId],
  );
  const visibleVehicles = useMemo(
    () => filterVisibleVehicles(vehicles, visibleVehicleRouteIds),
    [vehicles, visibleVehicleRouteIds],
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const initialStyle = initialStyleRef.current || "streets";
    const style = MAP_STYLES[initialStyle];
    try {
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: style.style,
        center: KYIV_CENTER,
        zoom: 10,
        pitch: style.pitch,
        bearing: 0,
        maxPitch: 70,
        attributionControl: false,
        cooperativeGestures: false,
      });
      currentStyleRef.current = initialStyle;
      map.addControl(
        new maplibregl.NavigationControl({
          showCompass: true,
          showZoom: true,
          visualizePitch: true,
        }),
        "bottom-right",
      );
      map.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        "bottom-left",
      );
      const handleStyleLoad = () => setStyleRevision((value) => value + 1);
      map.on("style.load", handleStyleLoad);
      map.on("click", ({ lngLat, point }) => {
        if (pickingPointRef.current) {
          onMapPointRef.current(lngLat.lat, lngLat.lng);
          return;
        }
        if (map.getLayer("selected-route-stop-points")) {
          const feature = map.queryRenderedFeatures(point, {
            layers: ["selected-route-stop-points"],
          })[0];
          const stopIndex = Number(feature?.properties?.stopIndex);
          if (Number.isInteger(stopIndex)) onStopRef.current(stopIndex);
        }
      });
      mapRef.current = map;
      return () => {
        vehicleMarkersRef.current.forEach((marker) => marker.remove());
        vehicleMarkersRef.current = [];
        map.off("style.load", handleStyleLoad);
        map.remove();
        mapRef.current = null;
      };
    } catch {
      setMapUnavailable(true);
    }
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || currentStyleRef.current === mapStyle) return;
    const style = MAP_STYLES[mapStyle];
    currentStyleRef.current = mapStyle;
    localStorage.setItem("metro-kyiv:map-style", mapStyle);
    map.setStyle(style.style);
    map.easeTo({
      pitch: style.pitch,
      bearing: 0,
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : 500,
    });
  }, [mapStyle]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded() || mapStyle !== "threeD") return;
    const existingBuildings = map
      .getStyle()
      .layers.find(
        (layer) =>
          layer.type === "fill-extrusion" &&
          "source-layer" in layer &&
          layer["source-layer"] === "building",
      );
    if (existingBuildings) {
      map.setLayoutProperty(existingBuildings.id, "visibility", "visible");
      return;
    }
    if (!map.getSource("openmaptiles") || map.getLayer("metro-kyiv-3d-buildings")) {
      return;
    }
    const firstLabelLayer = map
      .getStyle()
      .layers.find((layer) => layer.type === "symbol")?.id;
    map.addLayer({
      id: "metro-kyiv-3d-buildings",
      type: "fill-extrusion",
      source: "openmaptiles",
      "source-layer": "building",
      minzoom: 14,
      paint: {
        "fill-extrusion-color": [
          "interpolate",
          ["linear"],
          ["get", "render_height"],
          0,
          "#d8d5cd",
          80,
          "#b8b3a8",
        ],
        "fill-extrusion-height": [
          "coalesce",
          ["get", "render_height"],
          ["get", "height"],
          5,
        ],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
        "fill-extrusion-opacity": 0.82,
      },
    }, firstLabelLayer);
  }, [mapStyle, styleRevision]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const collection = emptyCollection();
    const stops = emptyCollection();
    if (selectedRoute !== null) {
      const route = data.routes[selectedRoute];
      const stopIndexes = new Set<number>();
      const patterns = data.patterns?.filter(
        (pattern) => pattern[0] === selectedRoute,
      );
      if (patterns?.length) {
        patterns.forEach((pattern) => {
          collection.features.push(
            lineFeature(pattern[3], { color: `#${route[4]}` }),
          );
          pattern[2].forEach((index) => stopIndexes.add(index));
        });
      } else for (const [from, to, routeIndex] of data.edges) {
        if (routeIndex !== selectedRoute) continue;
        const fromStop = data.stops[from];
        const toStop = data.stops[to];
        collection.features.push(
          lineFeature(
            [
              [fromStop[3], fromStop[2]],
              [toStop[3], toStop[2]],
            ],
            { color: `#${route[4]}` },
          ),
        );
        stopIndexes.add(from);
        stopIndexes.add(to);
      }
      stopIndexes.forEach((index) => {
        const stop = data.stops[index];
        stops.features.push(
          pointFeature([stop[3], stop[2]], {
            name: stop[1],
            color: `#${route[4]}`,
            stopIndex: index,
          }),
        );
      });
    }
    updateSource(map, "selected-route", collection);
    updateSource(map, "selected-route-stops", stops);
    if (!map.getLayer("selected-route-line")) {
      map.addLayer({
        id: "selected-route-line",
        type: "line",
        source: "selected-route",
        paint: {
          "line-color": ["get", "color"],
          "line-width": ["interpolate", ["linear"], ["zoom"], 9, 4, 15, 8],
          "line-opacity": 0.88,
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });
    }
    if (!map.getLayer("selected-route-stop-points")) {
      map.addLayer({
        id: "selected-route-stop-points",
        type: "circle",
        source: "selected-route-stops",
        minzoom: 12,
        paint: {
          "circle-radius": 4,
          "circle-color": ["get", "color"],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
    }
  }, [data, selectedRoute, styleRevision]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const line = emptyCollection();
    const stations = emptyCollection();
    if (selectedMetroLine) {
      const meta = LINE_META[selectedMetroLine];
      const metroStations = LINE_STATIONS[selectedMetroLine];
      line.features.push(
        lineFeature(
          metroStations.map((station) => [station.lon, station.lat]),
          { color: meta.color },
        ),
      );
      metroStations.forEach((station) =>
        stations.features.push(
          pointFeature([station.lon, station.lat], {
            name: station.name,
            color: meta.color,
          }),
        ),
      );
    }
    updateSource(map, "selected-metro", line);
    updateSource(map, "selected-metro-stations", stations);
    if (!map.getLayer("selected-metro-line")) {
      map.addLayer({
        id: "selected-metro-line",
        type: "line",
        source: "selected-metro",
        paint: { "line-color": ["get", "color"], "line-width": 8 },
        layout: { "line-cap": "round", "line-join": "round" },
      });
    }
    if (!map.getLayer("selected-metro-stop-points")) {
      map.addLayer({
        id: "selected-metro-stop-points",
        type: "circle",
        source: "selected-metro-stations",
        paint: {
          "circle-radius": 5,
          "circle-color": ["get", "color"],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
    }
  }, [selectedMetroLine, styleRevision]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const rideLegs = emptyCollection();
    const walkLegs = emptyCollection();
    const points = emptyCollection();
    if (activePlan) {
      let previousRouteId: string | null = null;
      let transferNumber = 0;
      activePlan.legs.forEach((leg) => {
        const coordinates = journeyLegCoordinates(data, leg);
        if (coordinates.length >= 2) {
          (leg.mode === "walk" ? walkLegs : rideLegs).features.push(
            lineFeature(coordinates, {
              color: leg.route?.color || "#64706b",
              label: leg.route?.short || "Пішки",
            }),
          );
        }
        if (
          leg.route &&
          previousRouteId &&
          leg.route.id !== previousRouteId
        ) {
          transferNumber += 1;
          points.features.push(
            pointFeature([leg.from.lon, leg.from.lat], {
              label: String(transferNumber),
              kind: "transfer",
            }),
          );
        }
        if (leg.route) previousRouteId = leg.route.id;
      });
      points.features.push(
        pointFeature([activePlan.from.lon, activePlan.from.lat], {
          label: "A",
          kind: "start",
        }),
        pointFeature([activePlan.to.lon, activePlan.to.lat], {
          label: "Б",
          kind: "finish",
        }),
      );
    }
    updateSource(map, "journey-ride", rideLegs);
    updateSource(map, "journey-walk", walkLegs);
    updateSource(map, "journey-points", points);
    if (!map.getLayer("journey-walk-line")) {
      map.addLayer({
        id: "journey-walk-line",
        type: "line",
        source: "journey-walk",
        paint: {
          "line-color": "#66736d",
          "line-width": 5,
          "line-dasharray": [1, 2],
          "line-opacity": 0.9,
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });
    }
    if (!map.getLayer("journey-ride-line")) {
      map.addLayer({
        id: "journey-ride-line",
        type: "line",
        source: "journey-ride",
        paint: {
          "line-color": ["get", "color"],
          "line-width": ["interpolate", ["linear"], ["zoom"], 9, 5, 15, 9],
          "line-opacity": 0.95,
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });
    }
    if (!map.getLayer("journey-point-circles")) {
      map.addLayer({
        id: "journey-point-circles",
        type: "circle",
        source: "journey-points",
        paint: {
          "circle-radius": ["match", ["get", "kind"], "transfer", 12, 15],
          "circle-color": [
            "match",
            ["get", "kind"],
            "start",
            "#18a66c",
            "finish",
            "#247fd0",
            "#17241e",
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 3,
        },
      });
      map.addLayer({
        id: "journey-point-labels",
        type: "symbol",
        source: "journey-points",
        layout: {
          "text-field": ["get", "label"],
          "text-size": 11,
          "text-font": ["Noto Sans Bold"],
          "text-allow-overlap": true,
        },
        paint: { "text-color": "#ffffff" },
      });
    }
  }, [activePlan, data, styleRevision]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    vehicleMarkersRef.current.forEach((marker) => marker.remove());
    vehicleMarkersRef.current = [];
    const routeNames = new Map(data.routes.map((route) => [route[0], route[1]]));
    visibleVehicles.forEach((vehicle) => {
      const mode = vehicleMode(vehicle.routeId);
      const label = routeNames.get(vehicle.routeId) || vehicle.label || vehicle.routeId;
      const stale = Boolean(
        vehicle.timestamp && Date.now() / 1000 - vehicle.timestamp > 180,
      );
      const speed = Math.max(0, Math.round(vehicle.speed * 3.6));
      const updatedAt = vehicle.timestamp
        ? new Date(vehicle.timestamp * 1000).toLocaleTimeString("uk-UA", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "невідомо";
      const popup = new maplibregl.Popup({ offset: 24, closeButton: true }).setHTML(
        `<strong>Маршрут ${safeText(label)}</strong><br><span>${
          stale ? "Дані можуть бути застарілими" : "GPS наживо"
        } · ${speed} км/год</span><br><small>Оновлено: ${updatedAt}</small>`,
      );
      vehicleMarkersRef.current.push(
        new maplibregl.Marker({
          element: createVehicleElement(label, mode, vehicle.bearing, stale),
          anchor: "center",
        })
          .setLngLat([vehicle.longitude, vehicle.latitude])
          .setPopup(popup)
          .addTo(map),
      );
    });
    return () => {
      vehicleMarkersRef.current.forEach((marker) => marker.remove());
      vehicleMarkersRef.current = [];
    };
  }, [data, visibleVehicles, styleRevision]);

  const focusCoordinates = useMemo(() => {
    if (activePlan) {
      return activePlan.legs.flatMap((leg) =>
        journeyLegCoordinates(data, leg),
      );
    }
    if (selectedMetroLine) {
      return LINE_STATIONS[selectedMetroLine].map(
        (station) => [station.lon, station.lat] as Coordinate,
      );
    }
    if (selectedRoute !== null) return routeCoordinates(data, selectedRoute);
    return [];
  }, [activePlan, data, selectedMetroLine, selectedRoute]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleRevision) return;
    const fitKey = activePlan
      ? `plan:${activePlan.from.lat}:${activePlan.to.lat}:${activePlan.totalMinutes}`
      : selectedMetroLine
        ? `metro:${selectedMetroLine}`
        : selectedRoute !== null
          ? `route:${selectedRoute}`
          : showRegion
            ? "region"
            : "kyiv";
    const completeFitKey = `${fitKey}:${panelOpen}:${mapStyle}`;
    if (completeFitKey === lastFitKey.current) return;
    lastFitKey.current = completeFitKey;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (focusCoordinates.length) {
      const bounds = new maplibregl.LngLatBounds();
      focusCoordinates.forEach((coordinate) => bounds.extend(coordinate));
      map.fitBounds(bounds, {
        padding: {
          top: 90,
          right: 65,
          bottom: window.innerWidth < 900 ? 150 : 65,
          left: window.innerWidth >= 900 && panelOpen ? 455 : 65,
        },
        maxZoom: 15,
        duration: reducedMotion ? 0 : 650,
      });
    } else if (showRegion) {
      map.fitBounds(KYIV_REGION_BOUNDS, {
        padding: 40,
        duration: reducedMotion ? 0 : 650,
      });
    } else {
      map.easeTo({
        center: KYIV_CENTER,
        zoom: 10,
        duration: reducedMotion ? 0 : 650,
      });
    }
  }, [
    activePlan,
    focusCoordinates,
    mapStyle,
    panelOpen,
    selectedMetroLine,
    selectedRoute,
    showRegion,
    styleRevision,
  ]);

  const resetView = () => {
    lastFitKey.current = "";
    const map = mapRef.current;
    if (!map) return;
    if (focusCoordinates.length) {
      const bounds = new maplibregl.LngLatBounds();
      focusCoordinates.forEach((coordinate) => bounds.extend(coordinate));
      map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
    } else if (showRegion) map.fitBounds(KYIV_REGION_BOUNDS, { padding: 40 });
    else map.easeTo({ center: KYIV_CENTER, zoom: 10 });
  };

  return (
    <div
      className={`transit-map-shell ${pickingPoint ? "is-picking-point" : ""}`}
    >
      <div ref={containerRef} className="transit-vector-map" />
      {mapUnavailable && (
        <div className="transit-map-unavailable" role="status">
          <strong>3D-карта недоступна на цьому пристрої</strong>
          <span>Спробуйте оновити браузер або вимкнути режим енергозбереження.</span>
        </div>
      )}
      <div className="transport-map-style-switcher" aria-label="Вигляд карти">
        {(Object.entries(MAP_STYLES) as [MapStyleId, (typeof MAP_STYLES)[MapStyleId]][]).map(
          ([id, style]) => (
            <button
              type="button"
              className={mapStyle === id ? "is-active" : ""}
              onClick={() => setMapStyle(id)}
              aria-pressed={mapStyle === id}
              title={style.label}
              key={id}
            >
              {style.short}
            </button>
          ),
        )}
      </div>
      <div className={`transit-vehicle-scope ${visibleVehicles.length ? "has-live" : ""}`}>
        <i />
        <span>
          {visibleVehicles.length
            ? `${visibleVehicles.length} GPS · обране та поїздка`
            : favoriteRouteIds.length
              ? "Обрані маршрути зараз без GPS"
              : "Додайте маршрут в обране — і він з’явиться тут"}
        </span>
      </div>
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
