import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";
import {
  LINE_STATIONS,
  STATION_BY_ID,
  STATIONS,
  TRANSFERS,
  estimateTripMinutes,
  getRoute,
  getServiceInterval,
  getStationPredictions,
  routeTransfers,
} from "../app/metro-data.ts";
import { decodeGtfsRealtime } from "../app/gtfs-realtime.ts";
import {
  findTransitPlan,
  getTransitPlaces,
} from "../app/transit-router.ts";

test("network contains 52 unique stations and three valid transfers", () => {
  assert.equal(STATIONS.length, 52);
  assert.equal(new Set(STATIONS.map(({ id }) => id)).size, 52);
  assert.equal(TRANSFERS.length, 3);

  for (const [from, to] of TRANSFERS) {
    assert.ok(STATION_BY_ID[from]);
    assert.ok(STATION_BY_ID[to]);
    assert.notEqual(STATION_BY_ID[from].line, STATION_BY_ID[to].line);
  }
});

test("every station pair has a reversible shortest route", () => {
  for (const from of STATIONS) {
    for (const to of STATIONS) {
      const route = getRoute(from.id, to.id);
      const reverse = getRoute(to.id, from.id);
      assert.equal(route[0], from.id);
      assert.equal(route.at(-1), to.id);
      assert.deepEqual(reverse, [...route].reverse());
      assert.ok(estimateTripMinutes(route) >= 0);
    }
  }
});

test("cross-line routes count transfers correctly", () => {
  const route = getRoute("akademmistechko", "teremky");
  assert.equal(routeTransfers(route), 1);
  assert.ok(route.includes("khreshchatyk"));
  assert.ok(route.includes("maidan-nezalezhnosti"));
});

test("timer predictions stay within the active official interval model", () => {
  const peak = new Date("2026-07-23T08:15:30+03:00");
  const interval = getServiceInterval(peak);
  assert.equal(interval.isPeak, true);
  assert.equal(interval.minSeconds, 150);
  assert.equal(interval.maxSeconds, 210);

  for (const station of STATIONS) {
    const predictions = getStationPredictions(station, peak);
    assert.equal(predictions.length, 2);
    for (const prediction of predictions) {
      assert.ok(prediction.seconds >= 0);
      assert.ok(prediction.seconds <= prediction.intervalSeconds);
      assert.ok(prediction.intervalSeconds >= interval.minSeconds);
      assert.ok(prediction.intervalSeconds <= interval.maxSeconds);
      assert.equal(
        prediction.followingSeconds,
        prediction.seconds + prediction.intervalSeconds,
      );
    }
  }
});

test("map coordinates are ordered and separated along every line", () => {
  for (const stations of Object.values(LINE_STATIONS)) {
    for (let index = 1; index < stations.length; index += 1) {
      const previous = stations[index - 1];
      const current = stations[index];
      const distance = Math.hypot(current.x - previous.x, current.y - previous.y);
      assert.ok(distance >= 40, `${previous.id} and ${current.id} are too close`);
    }
  }
});

test("map UI keeps labels out of the SVG and ships the high-resolution reference", () => {
  const appSource = readFileSync(new URL("../app/MetroApp.tsx", import.meta.url), "utf8");
  const gestureSource = readFileSync(
    new URL("../app/use-pinch-pan-zoom.ts", import.meta.url),
    "utf8",
  );
  const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const mapImage = new URL("../public/kyiv-metro-map-v1.12.3.png", import.meta.url);
  const mapPdf = new URL("../public/kyiv-metro-map-v1.12.3.pdf", import.meta.url);

  assert.doesNotMatch(appSource, /foreignObject/);
  assert.match(appSource, /function RouteJourney/);
  assert.match(appSource, /function OfficialMapViewer/);
  assert.match(gestureSource, /function usePinchPanZoom/);
  assert.match(appSource, /className="map-scroll map-scroll--gestures"/);
  assert.match(styles, /safe-area-inset-top/);
  assert.match(styles, /\.map-scroll--gestures[\s\S]*?touch-action: none/);
  assert.match(styles, /\.official-map__scroll[\s\S]*?touch-action: none/);
  assert.match(html, /maximum-scale=1, user-scalable=no/);
  assert.ok(statSync(mapImage).size > 2_000_000);
  assert.ok(statSync(mapPdf).size > 500_000);
});

test("official surface network is compact, complete and routable with metro", () => {
  const network = JSON.parse(
    readFileSync(new URL("../public/transit-network.json", import.meta.url), "utf8"),
  );
  assert.equal(network.stops.length, 1447);
  assert.equal(network.routes.length, 158);
  assert.ok(network.edges.length > 7000);
  assert.deepEqual(
    [...new Set(network.routes.map((route) => route[3]))].sort(),
    ["bus", "tram", "trolleybus"],
  );

  const places = getTransitPlaces(network);
  const from = places.find((place) => place.id === "metro:akademmistechko");
  const to = places.find((place) => /Чорнобильська/i.test(place.name));
  const plan = findTransitPlan(network, from.node, to.node);
  assert.ok(plan);
  assert.ok(plan.legs.some((leg) => leg.mode === "bus"));
  assert.ok(plan.totalMinutes > 0 && plan.totalMinutes < 60);
});

test("GTFS Realtime protobuf decoder reads official vehicle positions", () => {
  const fixture = Buffer.from(
    "Cg0KAzIuMBAAGOXYh9MGEjwKATAiNwoFKgMzXzMSFA2s30lCFbQ29UEdAAAAAC0AAAAAKIXYh9MGQhIKBjNfMzEzNBICMTAaBDgyNDg=",
    "base64",
  );
  const vehicles = decodeGtfsRealtime(
    fixture.buffer.slice(fixture.byteOffset, fixture.byteOffset + fixture.byteLength),
  );
  assert.equal(vehicles.length, 1);
  assert.equal(vehicles[0].routeId, "3_3");
  assert.equal(vehicles[0].label, "10");
  assert.ok(vehicles[0].latitude > 50 && vehicles[0].longitude > 30);
});
