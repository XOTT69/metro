import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("builds a static Cloudflare Pages entrypoint", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /<html lang="uk">/);
  assert.match(html, /<title>Metro Kyiv — метро та наземний транспорт<\/title>/);
  assert.match(html, /id="root"/);
  assert.match(html, /manifest\.webmanifest/);
  assert.match(html, /metro-kyiv\.pages\.dev\/og-v3\.png/);

  const assets = await readdir(new URL("../dist/assets/", import.meta.url));
  assert.ok(assets.some((name) => name.endsWith(".js")));
  assert.ok(assets.some((name) => name.endsWith(".css")));
  assert.ok(assets.some((name) => /^CityTransit-.*\.js$/.test(name)));
  assert.ok(assets.some((name) => /^CityTransit-.*\.css$/.test(name)));
  assert.ok(assets.some((name) => /^maplibre-gl-worker-.*\.js$/.test(name)));
});

test("ships the complete network and offline assets", async () => {
  const [data, manifest, serviceWorker] = await Promise.all([
    readFile(new URL("../app/metro-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../dist/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../dist/sw.js", import.meta.url), "utf8"),
  ]);

  const stationRows =
    data.match(/^\s{2}\["[a-z0-9-]+",\s*"[^"]+",\s*\d+/gm) ?? [];
  assert.equal(stationRows.length, 52);

  const parsedManifest = JSON.parse(manifest);
  assert.equal(parsedManifest.display, "standalone");
  assert.equal(parsedManifest.lang, "uk");
  assert.equal(parsedManifest.start_url, "/");
  assert.match(serviceWorker, /event\.request\.mode === "navigate"/);

  await access(new URL("../dist/metro-logo.svg", import.meta.url));
  await access(new URL("../dist/og.png", import.meta.url));
  await access(new URL("../dist/og-v3.png", import.meta.url));
  await access(new URL("../dist/transit-network.json", import.meta.url));
  assert.match(serviceWorker, /transport-alerts/);
  assert.match(serviceWorker, /url\.pathname === "\/api\/realtime"/);
  assert.match(serviceWorker, /url\.pathname === "\/api\/geocode"/);
});

test("keeps focused components outside the MetroApp root component", async () => {
  const appSource = await readFile(
    new URL("../app/MetroApp.tsx", import.meta.url),
    "utf8",
  );
  const defaultComponentSources = await Promise.all(
    [
      "StationSelect.tsx",
      "TimerDirections.tsx",
      "StationSheet.tsx",
      "MetroMap.tsx",
      "OfficialMapViewer.tsx",
      "MetroTripAssistant.tsx",
    ].map((file) =>
      readFile(new URL(`../app/components/${file}`, import.meta.url), "utf8"),
    ),
  );
  const routeDetailsSource = await readFile(
    new URL("../app/components/RouteDetails.tsx", import.meta.url),
    "utf8",
  );
  const viewSources = await Promise.all(
    ["PlannerView.tsx", "MapView.tsx", "StationsView.tsx", "SettingsView.tsx"].map(
      (file) => readFile(new URL(`../app/views/${file}`, import.meta.url), "utf8"),
    ),
  );
  const [
    clockSource,
    appTypesSource,
    navigationSource,
    preferencesSource,
    coordinateSource,
    pwaSource,
    toastSource,
    fetchSource,
    nearestSource,
    shareSource,
  ] = await Promise.all([
    readFile(new URL("../app/hooks/useNow.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/app-types.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/hooks/useMetroNavigation.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/hooks/useMetroPreferences.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/hooks/useOfficialMetroCoordinates.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/hooks/usePwaInstall.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/hooks/useToast.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/network/fetchWithTimeout.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/hooks/useNearestStation.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/hooks/useShareRoute.ts", import.meta.url), "utf8"),
  ]);
  const [cityTransitSource, transitMapSource, transitRouterSource] = await Promise.all([
    readFile(new URL("../app/CityTransit.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/TransitMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/transit-router.ts", import.meta.url), "utf8"),
  ]);
  const cityComponentSources = await Promise.all(
    [
      "AddressField.tsx",
      "PlanDetails.tsx",
      "TransitPlanPanel.tsx",
      "TransitCatalogPanel.tsx",
      "TransitAlertsPanel.tsx",
      "TransitDetailsPanel.tsx",
      "ActiveJourneyPanel.tsx",
      "TransitFloatingControls.tsx",
    ].map((file) =>
      readFile(new URL(`../app/city-transit/${file}`, import.meta.url), "utf8"),
    ),
  );
  const cityHookSources = await Promise.all(
    [
      "useTransitNetwork.ts",
      "useLiveVehicles.ts",
      "useTransportAlerts.ts",
    ].map((file) =>
      readFile(
        new URL(`../app/city-transit/hooks/${file}`, import.meta.url),
        "utf8",
      ),
    ),
  );

  for (const component of [
    "StationSelect",
    "TimerDirections",
    "MetroTripAssistant",
    "StationSheet",
    "MetroMap",
    "OfficialMapViewer",
    "RouteItinerary",
    "RouteJourney",
    "PlannerView",
    "MapView",
    "StationsView",
    "SettingsView",
  ]) {
    assert.doesNotMatch(appSource, new RegExp(`function ${component}`));
  }
  assert.ok(
    defaultComponentSources.every((source) =>
      /export default function/.test(source),
    ),
  );
  assert.match(routeDetailsSource, /export function RouteItinerary/);
  assert.match(routeDetailsSource, /export function RouteJourney/);
  assert.ok(
    viewSources.every((source) => /export default function/.test(source)),
  );
  assert.doesNotMatch(appSource, /setInterval|getStationPredictions|type View =/);
  assert.match(appSource, /lazy\(\(\) => import\("\.\/CityTransit"\)\)/);
  assert.match(appSource, /<Suspense/);
  assert.match(clockSource, /window\.setInterval/);
  assert.match(appTypesSource, /export type View/);
  assert.doesNotMatch(appSource, /URLSearchParams|localStorage|history\.replaceState/);
  assert.match(navigationSource, /window\.addEventListener\("popstate"/);
  assert.match(navigationSource, /replaceNavigationUrl/);
  assert.match(preferencesSource, /function readStorage/);
  assert.match(preferencesSource, /function writeStorage/);
  assert.doesNotMatch(
    appSource,
    /beforeinstallprompt|OFFICIAL_GEOJSON_URL|window\.setTimeout/,
  );
  assert.match(coordinateSource, /setStatus\("fallback"\)/);
  assert.match(pwaSource, /navigator\.serviceWorker\.register/);
  assert.match(toastSource, /window\.clearTimeout/);
  assert.match(fetchSource, /AbortController/);
  assert.doesNotMatch(
    appSource,
    /navigator\.geolocation|navigator\.share|navigator\.clipboard/,
  );
  assert.match(nearestSource, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(shareSource, /createRouteShareData/);
  for (const component of [
    "AddressField",
    "PlanServices",
    "PlanDetails",
    "TransitPlanPanel",
    "TransitCatalogPanel",
    "TransitAlertsPanel",
  ]) {
    assert.doesNotMatch(cityTransitSource, new RegExp(`function ${component}`));
  }
  assert.ok(cityComponentSources.every((source) => /export (default )?function/.test(source)));
  assert.ok(cityTransitSource.split("\n").length < 650);
  assert.match(cityTransitSource, /useTransitPlanner/);
  assert.match(
    await readFile(
      new URL("../app/city-transit/transit.worker.ts", import.meta.url),
      "utf8",
    ),
    /createTransitRouter/,
  );
  assert.match(transitRouterSource, /export function createTransitRouter/);
  assert.doesNotMatch(transitRouterSource, /let cached(?:Source|Graph)/);
  assert.doesNotMatch(
    cityTransitSource,
    /fetch\("\/(?:transit-network\.json|api\/realtime|api\/alerts)/,
  );
  assert.ok(cityHookSources.every((source) => /AbortController/.test(source)));
  assert.match(cityHookSources[1], /window\.setInterval/);
  assert.match(cityHookSources[2], /window\.setInterval/);
  assert.doesNotMatch(transitMapSource, /from "leaflet"|L\.tileLayer/);
  assert.match(transitMapSource, /from "maplibre-gl"/);
  assert.match(transitMapSource, /maplibre-gl-worker\.mjs\?worker&url/);
  for (const source of [
    "selected-route",
    "selected-metro",
    "journey-ride",
    "journey-walk",
    "journey-points",
  ]) {
    assert.match(transitMapSource, new RegExp(`"${source}"`));
  }
  assert.match(
    transitMapSource,
    /\[data, visibleVehicles, styleRevision\]/,
  );
  assert.match(transitMapSource, /getVisibleVehicleRouteIds/);
  assert.match(transitMapSource, /World_Street_Map/);
  assert.match(transitMapSource, /tiles\.openfreemap\.org\/planet/);
  assert.match(transitMapSource, /tiles\.openfreemap\.org\/fonts/);
  assert.doesNotMatch(transitMapSource, /LIGHT_STYLE|DARK_STYLE/);
  assert.match(transitMapSource, /World_Imagery/);
  assert.match(transitMapSource, /fill-extrusion/);
});
