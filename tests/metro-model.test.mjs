import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";
import { VIEW_IDS, isView } from "../app/app-types.ts";
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
  createTransitRouter,
  findTransitPlan,
  findTransitPlansBetweenPoints,
  getTransitPlaces,
} from "../app/transit-router.ts";

test("view registry is the single source of truth for navigation", () => {
  assert.deepEqual(VIEW_IDS, ["planner", "city", "map", "stations", "settings"]);
  assert.equal(isView("stations"), true);
  assert.equal(isView("unknown"), false);
  assert.equal(isView(null), false);
});

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
  const peak = new Date("2026-07-23T05:15:30Z");
  const interval = getServiceInterval(peak);
  assert.equal(interval.isPeak, true);
  assert.equal(interval.minSeconds, 150);
  assert.equal(interval.maxSeconds, 210);

  const kyivWeekend = getServiceInterval(
    new Date("2026-07-24T21:30:00Z"),
  );
  assert.match(kyivWeekend.label, /^вихідний/);

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
  const interactiveMapSource = readFileSync(
    new URL("../app/components/MetroMap.tsx", import.meta.url),
    "utf8",
  );
  const officialMapSource = readFileSync(
    new URL("../app/components/OfficialMapViewer.tsx", import.meta.url),
    "utf8",
  );
  const routeSource = readFileSync(
    new URL("../app/components/RouteDetails.tsx", import.meta.url),
    "utf8",
  );
  const gestureSource = readFileSync(
    new URL("../app/use-pinch-pan-zoom.ts", import.meta.url),
    "utf8",
  );
  const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const mapImage = new URL("../public/kyiv-metro-map-v1.12.3.png", import.meta.url);
  const mapPdf = new URL("../public/kyiv-metro-map-v1.12.3.pdf", import.meta.url);

  assert.doesNotMatch(appSource, /foreignObject/);
  assert.match(routeSource, /function RouteJourney/);
  assert.match(officialMapSource, /function OfficialMapViewer/);
  assert.match(gestureSource, /function usePinchPanZoom/);
  assert.match(interactiveMapSource, /className="map-scroll map-scroll--gestures"/);
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
  assert.ok(network.stops.length >= 3250);
  assert.ok(network.routes.length >= 265);
  assert.ok(network.edges.length > 11000);
  assert.ok(network.patterns.length > 200);
  assert.deepEqual(
    [...new Set(network.routes.map((route) => route[3]))].sort(),
    ["bus", "minibus", "tram", "trolleybus"],
  );

  const places = getTransitPlaces(network);
  const from = places.find((place) => place.id === "metro:akademmistechko");
  const to = places.find((place) => /Чорнобильська/i.test(place.name));
  const plan = findTransitPlan(network, from.node, to.node, {
    departureMinute: 11 * 60,
  });
  assert.ok(plan);
  assert.ok(plan.legs.some((leg) => leg.mode === "bus"));
  assert.ok(plan.totalMinutes > 0 && plan.totalMinutes < 60);
});

test("explicit transit routers reuse one graph and isolate network updates", () => {
  const network = JSON.parse(
    readFileSync(new URL("../public/transit-network.json", import.meta.url), "utf8"),
  );
  const router = createTransitRouter(network);
  const places = router.places;
  const nearest = router.findNearestPlace(50.4473, 30.5229);

  assert.strictEqual(router.places, places);
  assert.ok(places.includes(nearest));

  const updatedNetwork = {
    ...network,
    stops: [
      ...network.stops,
      ["test-stop", "Тестова зупинка", 50.45, 30.52],
    ],
  };
  const updatedRouter = createTransitRouter(updatedNetwork);

  assert.notStrictEqual(updatedRouter.places, places);
  assert.equal(places.some((place) => place.id === "stop:test-stop"), false);
  assert.equal(
    updatedRouter.places.some((place) => place.id === "stop:test-stop"),
    true,
  );
});

test("address routing returns alternatives with full map geometry", () => {
  const network = JSON.parse(
    readFileSync(new URL("../public/transit-network.json", import.meta.url), "utf8"),
  );
  const places = getTransitPlaces(network);
  const from = places.find((place) => place.id === "metro:akademmistechko");
  const to = places.find((place) => place.id === "metro:kontraktova-ploshcha");
  const plans = findTransitPlansBetweenPoints(
    network,
    { ...from, id: "address:from" },
    { ...to, id: "address:to" },
    4,
  );
  assert.ok(plans.length >= 3);
  assert.ok(plans[0].legs.every((leg) => leg.path.length >= 2));
  assert.ok(plans[0].totalMinutes < plans.at(-1).totalMinutes);
});

test("route profiles change the recommended path without falsifying travel time", () => {
  const network = JSON.parse(
    readFileSync(new URL("../public/transit-network.json", import.meta.url), "utf8"),
  );
  const places = getTransitPlaces(network);
  const from = places.find((place) => place.id === "stop:3_11328");
  const to = places.find((place) => place.id === "stop:3_9544");
  const pointFrom = { ...from, id: "profile:from" };
  const pointTo = { ...to, id: "profile:to" };
  const departureMinute = 11 * 60;
  const fastest = findTransitPlansBetweenPoints(
    network,
    pointFrom,
    pointTo,
    4,
    { profile: "fastest", departureMinute },
  )[0];
  const fewestTransfers = findTransitPlansBetweenPoints(
    network,
    pointFrom,
    pointTo,
    4,
    { profile: "fewest-transfers", departureMinute },
  )[0];
  const lessWalking = findTransitPlansBetweenPoints(
    network,
    pointFrom,
    pointTo,
    4,
    { profile: "less-walking", departureMinute },
  )[0];
  const preferred = findTransitPlansBetweenPoints(
    network,
    pointFrom,
    pointTo,
    4,
    {
      profile: "favorites",
      favoriteRouteIds: new Set(["3_533"]),
      departureMinute,
    },
  )[0];

  assert.ok(fastest.totalMinutes <= fewestTransfers.totalMinutes);
  assert.ok(fewestTransfers.transfers <= fastest.transfers);
  assert.ok(lessWalking.walkMinutes <= fastest.walkMinutes);
  assert.ok(preferred.legs.some((leg) => leg.route?.id === "3_533"));
  assert.equal(
    preferred.totalMinutes,
    Math.round(
      preferred.legs.reduce(
        (seconds, leg) => seconds + leg.seconds + leg.waitSeconds,
        0,
      ) / 60,
    ),
  );
});

test("departure time changes boarding waits and the recommended ETA", () => {
  const network = JSON.parse(
    readFileSync(new URL("../public/transit-network.json", import.meta.url), "utf8"),
  );
  const places = getTransitPlaces(network);
  const from = places.find((place) => place.id === "metro:akademmistechko");
  const to = places.find((place) => place.id === "metro:kontraktova-ploshcha");
  const peak = findTransitPlansBetweenPoints(
    network,
    { ...from, id: "time:from" },
    { ...to, id: "time:to" },
    1,
    { departureMinute: 8 * 60 },
  )[0];
  const late = findTransitPlansBetweenPoints(
    network,
    { ...from, id: "time:from" },
    { ...to, id: "time:to" },
    1,
    { departureMinute: 23 * 60 },
  )[0];
  assert.ok(peak && late);
  assert.ok(late.totalMinutes > peak.totalMinutes);
});

test("arrive-by routing converges on a schedule-aware departure", () => {
  const network = JSON.parse(
    readFileSync(new URL("../public/transit-network.json", import.meta.url), "utf8"),
  );
  const places = getTransitPlaces(network);
  const from = places.find((place) => place.id === "metro:akademmistechko");
  const to = places.find((place) => place.id === "metro:kontraktova-ploshcha");
  const arriveBy = findTransitPlansBetweenPoints(
    network,
    { ...from, id: "arrive:from" },
    { ...to, id: "arrive:to" },
    1,
    { arrivalMinute: 8 * 60 + 45 },
  )[0];
  assert.ok(arriveBy);
  assert.ok(arriveBy.totalMinutes > 0 && arriveBy.totalMinutes < 90);
});

test("Kyiv region addresses connect through an explicit suburban leg", () => {
  const network = JSON.parse(
    readFileSync(new URL("../public/transit-network.json", import.meta.url), "utf8"),
  );
  const places = getTransitPlaces(network);
  const maidan = places.find(
    (place) => place.id === "metro:maidan-nezalezhnosti",
  );
  const plans = findTransitPlansBetweenPoints(
    network,
    {
      id: "region:bila-tserkva",
      name: "Біла Церква",
      detail: "Київська область",
      lat: 49.7957,
      lon: 30.1311,
    },
    { ...maidan, id: "address:maidan" },
    3,
  );
  assert.ok(plans.length >= 1);
  assert.ok(
    plans[0].legs.some(
      (leg) => leg.route?.id === "region:bila-tserkva" && leg.route.status === "registry",
    ),
  );
  assert.ok(plans[0].legs.some((leg) => leg.mode === "metro"));
  assert.ok(plans[0].totalMinutes > 90 && plans[0].totalMinutes < 260);
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
