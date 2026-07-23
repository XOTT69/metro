import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseOfficialMetroCoordinates,
  useOfficialMetroCoordinates,
} from "../app/hooks/useOfficialMetroCoordinates";
import { usePwaInstall } from "../app/hooks/usePwaInstall";
import { useToast } from "../app/hooks/useToast";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window.navigator, "serviceWorker");
});

describe("official metro coordinates", () => {
  it("normalizes valid Kyiv GeoJSON features", () => {
    expect(
      parseOfficialMetroCoordinates({
        features: [
          {
            properties: { NAME: "Хрещатик" },
            geometry: { coordinates: [30.5229, 50.4473] },
          },
          {
            properties: { name: "Майдан Незалежності" },
            geometry: { coordinates: ["invalid", null] },
          },
        ],
      }),
    ).toEqual({ khreshchatyk: [50.4473, 30.5229] });
  });

  it("loads official coordinates and reports their count", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          features: [
            {
              properties: { station_name: "Хрещатик" },
              geometry: { coordinates: [30.5229, 50.4473] },
            },
          ],
        }),
      ),
    );

    const { result } = renderHook(() => useOfficialMetroCoordinates());

    await waitFor(() => expect(result.current.status).toBe("official"));
    expect(result.current.officialCoordinateCount).toBe(1);
    expect(result.current.coordinates.khreshchatyk).toEqual([50.4473, 30.5229]);
  });

  it("keeps the local fallback when the API fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 503 })),
    );

    const { result } = renderHook(() => useOfficialMetroCoordinates());

    await waitFor(() => expect(result.current.status).toBe("fallback"));
    expect(result.current.coordinates).toEqual({});
  });
});

describe("PWA install", () => {
  it("registers offline support and consumes one install prompt", async () => {
    const register = vi.fn(async () => undefined);
    Object.defineProperty(window.navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });
    const showToast = vi.fn();
    const prompt = vi.fn(async () => undefined);
    const { result } = renderHook(() => usePwaInstall(showToast));

    await waitFor(() => expect(register).toHaveBeenCalledWith("/sw.js"));
    await act(() => result.current.triggerInstall());
    expect(showToast).toHaveBeenCalledWith(
      "У меню браузера оберіть «Встановити застосунок»",
    );

    const installEvent = Object.assign(
      new Event("beforeinstallprompt", { cancelable: true }),
      { prompt },
    );
    act(() => window.dispatchEvent(installEvent));
    expect(installEvent.defaultPrevented).toBe(true);
    expect(result.current.canInstall).toBe(true);

    await act(() => result.current.triggerInstall());
    expect(prompt).toHaveBeenCalledOnce();
    expect(result.current.canInstall).toBe(false);
  });
});

describe("toast lifecycle", () => {
  it("restarts its timeout for the newest message", () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useToast(1_000));

    act(() => result.current.showToast("Перше"));
    act(() => vi.advanceTimersByTime(700));
    act(() => result.current.showToast("Друге"));
    act(() => vi.advanceTimersByTime(700));
    expect(result.current.toast).toBe("Друге");

    act(() => vi.advanceTimersByTime(300));
    expect(result.current.toast).toBe("");
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
