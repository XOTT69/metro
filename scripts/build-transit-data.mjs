import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const GTFS_URL = "http://193.23.225.211:8002/export-gtfs-static";
const outputPath = resolve(process.argv[2] || "public/transit-network.json");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  const headers = rows.shift() || [];
  return rows
    .filter((values) => values.some(Boolean))
    .map((values) =>
      Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])),
    );
}

function seconds(value) {
  const [hours = 0, minutes = 0, secs = 0] = value.split(":").map(Number);
  return hours * 3600 + minutes * 60 + secs;
}

function distanceMeters(a, b) {
  const latScale = 111_320;
  const lonScale = Math.cos(((a.lat + b.lat) * Math.PI) / 360) * 111_320;
  return Math.hypot((a.lat - b.lat) * latScale, (a.lon - b.lon) * lonScale);
}

const workDir = mkdtempSync(join(tmpdir(), "metro-kyiv-gtfs-"));
const archivePath = join(workDir, "gtfs.zip");
const extractDir = join(workDir, "gtfs");

try {
  const response = await fetch(GTFS_URL);
  if (!response.ok) throw new Error(`GTFS download failed: ${response.status}`);
  writeFileSync(archivePath, Buffer.from(await response.arrayBuffer()));
  const unzip = spawnSync("unzip", ["-q", archivePath, "-d", extractDir], {
    encoding: "utf8",
  });
  if (unzip.status !== 0) throw new Error(unzip.stderr || "Unable to unzip GTFS");

  const load = (name) =>
    parseCsv(readFileSync(join(extractDir, `${name}.txt`), "utf8"));
  const stopsRows = load("stops");
  const routesRows = load("routes");
  const tripsRows = load("trips");
  const stopTimesRows = load("stop_times");
  const feedInfo = load("feed_info")[0] || {};

  const stops = stopsRows.map((stop) => ({
    id: stop.stop_id,
    name: stop.stop_name.trim(),
    lat: Number(stop.stop_lat),
    lon: Number(stop.stop_lon),
  }));
  const stopIndex = new Map(stops.map((stop, index) => [stop.id, index]));

  const typeNames = { 0: "tram", 3: "bus", 11: "trolleybus" };
  const typeColors = { tram: "e94b35", bus: "f29f05", trolleybus: "2775d8" };
  const routes = routesRows
    .filter((route) => typeNames[route.route_type])
    .map((route) => {
      const type = typeNames[route.route_type];
      return {
        id: route.route_id,
        short: route.route_short_name.trim(),
        long: route.route_long_name.trim(),
        type,
        color: (route.route_color || typeColors[type]).replace(/^#/, ""),
      };
    });
  const routeIndex = new Map(routes.map((route, index) => [route.id, index]));
  const tripRoute = new Map(
    tripsRows
      .filter((trip) => routeIndex.has(trip.route_id))
      .map((trip) => [trip.trip_id, trip.route_id]),
  );
  const tripDirection = new Map(
    tripsRows.map((trip) => [trip.trip_id, trip.direction_id || "0"]),
  );

  const timesByTrip = new Map();
  for (const item of stopTimesRows) {
    if (!tripRoute.has(item.trip_id) || !stopIndex.has(item.stop_id)) continue;
    const times = timesByTrip.get(item.trip_id) || [];
    times.push({
      stop: item.stop_id,
      sequence: Number(item.stop_sequence),
      arrival: seconds(item.arrival_time),
      departure: seconds(item.departure_time),
    });
    timesByTrip.set(item.trip_id, times);
  }

  const rideStats = new Map();
  for (const [tripId, times] of timesByTrip) {
    const routeId = tripRoute.get(tripId);
    const route = routeIndex.get(routeId);
    times.sort((a, b) => a.sequence - b.sequence);
    for (let index = 1; index < times.length; index += 1) {
      const from = stopIndex.get(times[index - 1].stop);
      const to = stopIndex.get(times[index].stop);
      if (from === to) continue;
      let duration = times[index].arrival - times[index - 1].departure;
      if (!Number.isFinite(duration) || duration <= 0 || duration > 2400) {
        duration = 120;
      }
      const key = `${from}|${to}|${route}`;
      const stat = rideStats.get(key) || { from, to, route, total: 0, count: 0 };
      stat.total += duration;
      stat.count += 1;
      rideStats.set(key, stat);
    }
  }

  const edges = [...rideStats.values()].map((stat) => [
    stat.from,
    stat.to,
    stat.route,
    Math.max(45, Math.round(stat.total / stat.count)),
  ]);

  const representativeTrips = new Map();
  for (const [tripId, times] of timesByTrip) {
    const routeId = tripRoute.get(tripId);
    const route = routeIndex.get(routeId);
    const direction = tripDirection.get(tripId) || "0";
    const key = `${route}|${direction}`;
    const current = representativeTrips.get(key);
    if (!current || current.length < times.length) {
      representativeTrips.set(
        key,
        [...times].sort((a, b) => a.sequence - b.sequence),
      );
    }
  }
  const patterns = [...representativeTrips].map(([key, times]) => {
    const [route, direction] = key.split("|").map(Number);
    const indexes = times.map((time) => stopIndex.get(time.stop));
    return [
      route,
      direction ? "Зворотній" : "Прямий",
      indexes,
      indexes.map((index) => [stops[index].lon, stops[index].lat]),
    ];
  });

  const cellSize = 0.003;
  const grid = new Map();
  const cellKey = (lat, lon) => `${Math.floor(lat / cellSize)}:${Math.floor(lon / cellSize)}`;
  stops.forEach((stop, index) => {
    const key = cellKey(stop.lat, stop.lon);
    const values = grid.get(key) || [];
    values.push(index);
    grid.set(key, values);
  });

  stops.forEach((stop, from) => {
    const latCell = Math.floor(stop.lat / cellSize);
    const lonCell = Math.floor(stop.lon / cellSize);
    const nearby = [];
    for (let latOffset = -1; latOffset <= 1; latOffset += 1) {
      for (let lonOffset = -1; lonOffset <= 1; lonOffset += 1) {
        const candidates = grid.get(`${latCell + latOffset}:${lonCell + lonOffset}`) || [];
        for (const to of candidates) {
          if (from === to) continue;
          const distance = distanceMeters(stop, stops[to]);
          if (distance <= 280) nearby.push({ to, distance });
        }
      }
    }
    nearby
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5)
      .forEach(({ to, distance }) => {
        edges.push([from, to, -1, Math.max(45, Math.round(distance / 1.2))]);
      });
  });

  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: "Kyiv City Open Data / Kyivpastrans GTFS Static",
    sourceUrl:
      "https://data.kyivcity.gov.ua/dataset/rozklad-rukhu-miskoho-elektrychnoho-ta-avtomobilnoho-transportu-dep-transport",
    feedVersion: feedInfo.feed_version || feedInfo.feed_end_date || "",
    stops: stops.map((stop) => [
      stop.id,
      stop.name,
      Number(stop.lat.toFixed(6)),
      Number(stop.lon.toFixed(6)),
    ]),
    routes: routes.map((route) => [
      route.id,
      route.short,
      route.long,
      route.type,
      route.color,
      "schedule",
    ]),
    edges,
    patterns,
  };

  writeFileSync(outputPath, JSON.stringify(payload));
  console.log(
    `Wrote ${outputPath}: ${payload.stops.length} stops, ${payload.routes.length} routes, ${payload.edges.length} edges`,
  );
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
