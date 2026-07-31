import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("builds a compact Kyiv-metro PWA", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const assets = await readdir(new URL("../dist/assets/", import.meta.url));

  assert.match(html, /<html lang="uk">/);
  assert.match(html, /<title>Метро Київ — графік руху<\/title>/);
  assert.match(html, /id="root"/);
  assert.match(html, /manifest\.webmanifest/);
  assert.match(html, /rel="canonical" href="https:\/\/metrokyiv\.pp\.ua\/"/);
  assert.ok(assets.some((name) => name.endsWith(".js")));
  assert.ok(assets.some((name) => name.endsWith(".css")));
});

test("ships the offline timer and source-map assets", async () => {
  const [manifest, serviceWorker] = await Promise.all([
    readFile(new URL("../dist/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../dist/sw.js", import.meta.url), "utf8"),
  ]);
  const parsedManifest = JSON.parse(manifest);

  assert.equal(parsedManifest.display, "standalone");
  assert.equal(parsedManifest.lang, "uk");
  assert.equal(parsedManifest.start_url, "/");
  assert.match(serviceWorker, /metro-kyiv-v\d+/);
  assert.match(serviceWorker, /event\.request\.mode === "navigate"/);
  assert.match(serviceWorker, /kyiv-metro-map-v1\.12\.3\.png/);
  assert.match(serviceWorker, /notificationclick/);

  await access(new URL("../dist/metro-logo.svg", import.meta.url));
  await access(new URL("../dist/og.png", import.meta.url));
  await access(new URL("../dist/kyiv-metro-map-v1.12.3.png", import.meta.url));
});

test("the initial screen waits for explicit origin and destination", async () => {
  const appSource = await readFile(new URL("../app/MetroApp.tsx", import.meta.url), "utf8");

  assert.match(appSource, /useState\(""\)/);
  assert.match(appSource, /label="Звідки"/);
  assert.match(appSource, /label="Куди"/);
  assert.match(appSource, /const hasJourney = Boolean\(station && destination\)/);
  assert.match(appSource, /\{hasJourney && station && destination && predictions && activePrediction &&/);
});
