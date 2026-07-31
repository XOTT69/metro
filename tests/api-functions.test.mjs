import assert from "node:assert/strict";
import test from "node:test";
import { onRequestGet as getAlerts } from "../functions/api/alerts.ts";
import { onRequestGet as getGeocode } from "../functions/api/geocode.ts";
import { onRequestGet as getRealtime } from "../functions/api/realtime.ts";
import {
  UpstreamTimeoutError,
  fetchWithTimeout,
} from "../functions/api/upstream.ts";

test("fetchWithTimeout aborts a stalled upstream request", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (_input, init) =>
    new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => {
        reject(new DOMException("Aborted", "AbortError"));
      });
    });

  try {
    await assert.rejects(
      fetchWithTimeout("https://example.test/stalled", {}, 5),
      UpstreamTimeoutError,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("realtime endpoint uses configured upstream and reports failure", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return new Response("Unavailable", { status: 503 });
  };

  try {
    const response = await getRealtime({
      env: { REALTIME_UPSTREAM_URL: "https://transport.example.test/live" },
    });
    assert.equal(requestedUrl, "https://transport.example.test/live");
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), {
      error: "Realtime transport data is temporarily unavailable",
      upstreamStatus: 503,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("alerts endpoint extracts operational notices from the official metro RSS", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      [
        "<rss><channel>",
        "<item><title>Рух поїздів метро змінено</title><link>http://metro.kyiv.ua/node/101</link><description>&lt;p&gt;Під час повітряної тривоги рух на наземній ділянці призупинено.&lt;/p&gt;</description><pubDate>Thu, 23 Jul 2026 10:00:00 +0000</pubDate><guid>101 at metro.kyiv.ua</guid></item>",
        "<item><title>Пасажиропотік за тиждень</title><link>http://metro.kyiv.ua/node/102</link><description>Звичайна статистика</description><pubDate>Thu, 23 Jul 2026 11:00:00 +0000</pubDate><guid>102 at metro.kyiv.ua</guid></item>",
        "</channel></rss>",
      ].join(""),
      { status: 200 },
    );

  try {
    const response = await getAlerts();
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.alerts.length, 1);
    assert.equal(payload.alerts[0].id, "101");
    assert.equal(payload.alerts[0].source, "Київський метрополітен");
    assert.match(payload.alerts[0].text, /повітряної тривоги/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocode identifies the app and caches normalized results", async () => {
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  let requestHeaders;
  let cachedResponse;

  globalThis.caches = {
    default: {
      match: async () => undefined,
      put: async (_key, response) => {
        cachedResponse = response;
      },
    },
  };
  globalThis.fetch = async (_input, init) => {
    requestHeaders = new Headers(init.headers);
    return Response.json([
      {
        place_id: 42,
        display_name: "Хрещатик, Київ, Україна",
        lat: "50.4473",
        lon: "30.5229",
        type: "road",
        address: { road: "Хрещатик", city: "Київ" },
      },
    ]);
  };

  try {
    const response = await getGeocode({
      request: new Request(
        "https://metrokyiv.pp.ua/api/geocode?q=Хрещатик",
      ),
    });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.results[0].name, "Хрещатик");
    assert.equal(payload.results[0].lat, 50.4473);
    assert.match(requestHeaders.get("user-agent"), /metrokyiv\.pp\.ua/);
    assert.equal(
      requestHeaders.get("referer"),
      "https://metrokyiv.pp.ua/",
    );
    assert.ok(cachedResponse instanceof Response);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.caches = originalCaches;
  }
});
