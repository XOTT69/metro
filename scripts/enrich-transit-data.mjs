import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const NETWORK_PATH = resolve(process.argv[2] || "public/transit-network.json");
const TAXI_ENDPOINT =
  "https://gisserver-stage.kyivcity.gov.ua/mayno/rest/services/KYIV_API/transport_public/MapServer/1/query";
const headers = {
  "User-Agent": "Metro Kyiv PWA/1.0 (https://metro-kyiv.pages.dev)",
  Referer: "https://data.kyivcity.gov.ua/",
};

function queryUrl(params) {
  const url = new URL(TAXI_ENDPOINT);
  Object.entries(params).forEach(([key, value]) =>
    url.searchParams.set(key, String(value)),
  );
  return url;
}

async function fetchJson(params) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(queryUrl(params), {
      headers,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`routeTaxi HTTP ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function loadTaxiFeatures() {
  const countPayload = await fetchJson({
    where: "1=1",
    returnCountOnly: true,
    f: "json",
  });
  const total = Number(countPayload.count || 0);
  const features = [];
  for (let offset = 0; offset < total; offset += 2000) {
    const payload = await fetchJson({
      where: "1=1",
      outFields:
        "objectid,num_route,from_code1,from_stop_,to_code1,to_stop_,napryamok,order_,is_start,is_end",
      returnGeometry: true,
      outSR: 4326,
      orderByFields: "objectid",
      resultOffset: offset,
      resultRecordCount: 2000,
      f: "geojson",
    });
    features.push(...(payload.features || []));
  }
  return features;
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function distanceMeters([lonA, latA], [lonB, latB]) {
  lonA = Number(lonA);
  latA = Number(latA);
  lonB = Number(lonB);
  latB = Number(latB);
  const latScale = 111_320;
  const lonScale = Math.cos(((latA + latB) * Math.PI) / 360) * 111_320;
  return Math.hypot((latA - latB) * latScale, (lonA - lonB) * lonScale);
}

function appendCoordinates(target, next) {
  for (const coordinate of next) {
    const previous = target.at(-1);
    if (
      !previous ||
      previous[0] !== coordinate[0] ||
      previous[1] !== coordinate[1]
    ) {
      target.push([
        Number(Number(coordinate[0]).toFixed(6)),
        Number(Number(coordinate[1]).toFixed(6)),
      ]);
    }
  }
}

const network = JSON.parse(readFileSync(NETWORK_PATH, "utf8"));
const taxiFeatures = await loadTaxiFeatures();
const routeGroups = new Map();

for (const feature of taxiFeatures) {
  const props = feature.properties || {};
  const routeNumber = clean(props.num_route);
  const direction = clean(props.napryamok) || "Маршрут";
  const coordinates = feature.geometry?.coordinates;
  if (!routeNumber || !Array.isArray(coordinates) || coordinates.length < 2) {
    continue;
  }
  const key = `${routeNumber}|${direction}`;
  const segments = routeGroups.get(key) || [];
  segments.push({
    order: Number(props.order_) || segments.length,
    fromCode: clean(props.from_code1) || `from:${props.objectid}`,
    fromName: clean(props.from_stop_) || "Зупинка",
    toCode: clean(props.to_code1) || `to:${props.objectid}`,
    toName: clean(props.to_stop_) || "Зупинка",
    coordinates,
  });
  routeGroups.set(key, segments);
}

const oldRouteIndexes = new Set(
  network.routes
    .map((route, index) => (String(route[0]).startsWith("taxi:") ? index : -1))
    .filter((index) => index >= 0),
);
if (oldRouteIndexes.size) {
  throw new Error("Network is already enriched; start from a GTFS snapshot");
}

const stopIndex = new Map(network.stops.map((stop, index) => [stop[0], index]));
const stopFor = (code, name, coordinate) => {
  const id = `taxi:${code}`;
  if (stopIndex.has(id)) return stopIndex.get(id);
  const index = network.stops.length;
  network.stops.push([
    id,
    name,
    Number(Number(coordinate[1]).toFixed(6)),
    Number(Number(coordinate[0]).toFixed(6)),
  ]);
  stopIndex.set(id, index);
  return index;
};

const groupedByRoute = new Map();
for (const [key, segments] of routeGroups) {
  const [routeNumber, direction] = key.split("|");
  const directions = groupedByRoute.get(routeNumber) || [];
  directions.push({
    direction,
    segments: segments.sort((a, b) => a.order - b.order),
  });
  groupedByRoute.set(routeNumber, directions);
}

network.patterns ||= [];
const collator = new Intl.Collator("uk", { numeric: true });
for (const [routeNumber, directions] of [...groupedByRoute].sort(([a], [b]) =>
  collator.compare(a, b),
)) {
  const direct = directions.find((item) => item.direction === "Прямий") || directions[0];
  const first = direct.segments[0];
  const last = direct.segments.at(-1);
  const routeIndex = network.routes.length;
  network.routes.push([
    `taxi:${routeNumber}`,
    routeNumber,
    `${first.fromName} — ${last.toName}`,
    "minibus",
    "8a4fc4",
    "estimated",
    10,
    20,
  ]);

  for (const { direction, segments } of directions) {
    const patternStops = [];
    const patternCoordinates = [];
    for (const segment of segments) {
      const from = stopFor(
        segment.fromCode,
        segment.fromName,
        segment.coordinates[0],
      );
      const to = stopFor(
        segment.toCode,
        segment.toName,
        segment.coordinates.at(-1),
      );
      if (patternStops.at(-1) !== from) patternStops.push(from);
      patternStops.push(to);
      appendCoordinates(patternCoordinates, segment.coordinates);
      const meters = segment.coordinates.slice(1).reduce(
        (sum, coordinate, index) =>
          sum + distanceMeters(segment.coordinates[index], coordinate),
        0,
      );
      network.edges.push([
        from,
        to,
        routeIndex,
        Math.max(45, Math.round(meters / 5.2) + 20),
      ]);
    }
    network.patterns.push([
      routeIndex,
      direction,
      [...new Set(patternStops)],
      patternCoordinates,
    ]);
  }
}

network.version = 2;
network.generatedAt = new Date().toISOString();
network.source =
  "Kyiv City Open Data: Kyivpastrans GTFS Static + official routeTaxi GeoJSON";
network.sources = [
  {
    name: "Kyivpastrans GTFS Static",
    status: "schedule",
    url: network.sourceUrl,
  },
  {
    name: "Kyiv routeTaxi GeoJSON",
    status: "estimated",
    url: "https://data.kyivcity.gov.ua/dataset/rozklad-rukhu-miskoho-elektrychnoho-ta-avtomobilnoho-transportu-dep-transport/resource/77325f5c-57d0-4f79-844a-cc73675f9743",
  },
];

writeFileSync(NETWORK_PATH, JSON.stringify(network));
console.log(
  `Enriched ${NETWORK_PATH}: ${network.stops.length} stops, ${network.routes.length} routes, ${network.patterns.length} patterns`,
);
