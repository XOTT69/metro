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
