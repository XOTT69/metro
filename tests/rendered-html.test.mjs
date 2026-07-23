import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render(url = "http://localhost/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(url, { headers: { accept: "text/html" } }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders Metro Kyiv", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html[^>]*lang="uk"/i);
  assert.match(html, /<title>Metro Kyiv — маршрути київським метро<\/title>/i);
  assert.match(html, /Київ — ближче/);
  assert.match(html, /52 станції/);
  assert.match(html, /Показати на схемі/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|SkeletonPreview/);
});

test("ships the complete network and PWA assets", async () => {
  const [data, manifest, serviceWorker] = await Promise.all([
    readFile(new URL("../app/metro-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
  ]);

  const stationRows =
    data.match(/^\s{2}\["[a-z0-9-]+",\s*"[^"]+",\s*\d+/gm) ?? [];
  assert.equal(stationRows.length, 52);
  assert.match(data, /const red: Station\[\]/);
  assert.match(data, /const blue: Station\[\]/);
  assert.match(data, /const green: Station\[\]/);
  assert.match(data, /FeatureServer\/1\/query/);

  const parsedManifest = JSON.parse(manifest);
  assert.equal(parsedManifest.display, "standalone");
  assert.equal(parsedManifest.lang, "uk");
  assert.equal(parsedManifest.start_url, "/");
  assert.match(serviceWorker, /caches\.open/);
  assert.match(serviceWorker, /event\.request\.mode === "navigate"/);

  await access(new URL("../public/metro-logo.svg", import.meta.url));
  await access(new URL("../public/og.png", import.meta.url));
});
