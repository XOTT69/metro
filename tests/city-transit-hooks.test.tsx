import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLiveVehicles } from "../app/city-transit/hooks/useLiveVehicles";
import { useTransitNetwork } from "../app/city-transit/hooks/useTransitNetwork";
import { useTransportAlerts } from "../app/city-transit/hooks/useTransportAlerts";
import type { TransitNetworkData } from "../app/transit-router";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const NETWORK: TransitNetworkData = {
  version: 1,
  generatedAt: "2026-07-23",
  source: "test",
  sourceUrl: "https://example.test",
  feedVersion: "1",
  stops: [],
  routes: [],
  edges: [],
};

describe("useTransitNetwork", () => {
  it("loads the static network", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(NETWORK)));

    const { result } = renderHook(() => useTransitNetwork());

    await waitFor(() => expect(result.current.data).toEqual(NETWORK));
    expect(result.current.loadError).toBe(false);
  });

  it("surfaces a failed network response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 503 })),
    );

    const { result } = renderHook(() => useTransitNetwork());

    await waitFor(() => expect(result.current.loadError).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("aborts an in-flight request when its consumer unmounts", async () => {
    let requestSignal: AbortSignal | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        requestSignal = init?.signal ?? null;
        return new Promise<Response>((_resolve, reject) => {
          requestSignal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }),
    );

    const { unmount } = renderHook(() => useTransitNetwork());
    await waitFor(() => expect(requestSignal).not.toBeNull());
    unmount();

    expect((requestSignal as AbortSignal | null)?.aborted).toBe(true);
  });
});

describe("useLiveVehicles", () => {
  it("decodes realtime positions and records the update time", async () => {
    const bytes = Uint8Array.from(
      window.atob(
        "Cg0KAzIuMBAAGOXYh9MGEjwKATAiNwoFKgMzXzMSFA2s30lCFbQ29UEdAAAAAC0AAAAAKIXYh9MGQhIKBjNfMzEzNBICMTAaBDgyNDg=",
      ),
      (character) => character.charCodeAt(0),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(bytes.buffer, { status: 200 })),
    );

    const { result } = renderHook(() => useLiveVehicles());

    await waitFor(() => expect(result.current.vehicles).toHaveLength(1));
    expect(result.current.vehicles[0]).toMatchObject({
      routeId: "3_3",
      label: "10",
    });
    expect(result.current.liveUpdatedAt).toBeInstanceOf(Date);
    expect(result.current.liveError).toBe(false);
  });
});

describe("useTransportAlerts", () => {
  it("loads official alerts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          alerts: [
            {
              id: "101",
              title: "Зміна руху",
              text: "Оновлений маршрут",
              publishedAt: "2026-07-23T10:00:00Z",
              url: "https://example.test/alert",
              source: "КМДА",
            },
          ],
        }),
      ),
    );

    const { result } = renderHook(() => useTransportAlerts());

    await waitFor(() => expect(result.current.alerts).toHaveLength(1));
    expect(result.current.alertsError).toBe(false);
  });

  it("reports invalid alert responses without replacing data", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ alerts: null })));

    const { result } = renderHook(() => useTransportAlerts());

    await waitFor(() => expect(result.current.alertsError).toBe(true));
    expect(result.current.alerts).toEqual([]);
  });
});
