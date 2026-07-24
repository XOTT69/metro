import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getNearestStation,
  useNearestStation,
} from "../app/hooks/useNearestStation";
import {
  createRouteShareData,
  useShareRoute,
} from "../app/hooks/useShareRoute";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

describe("nearest metro station", () => {
  it("uses official coordinate overrides when they are available", () => {
    const station = getNearestStation(50.4647, 30.6456, {
      akademmistechko: [50.4647, 30.6456],
    });

    expect(station.id).toBe("akademmistechko");
  });

  it("updates the route origin after geolocation", () => {
    const onFromChange = vi.fn();
    const showToast = vi.fn();
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: {
          latitude: 50.4647,
          longitude: 30.6456,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON: () => ({}),
        },
        timestamp: Date.now(),
        toJSON: () => ({}),
      });
    });
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
    const { result } = renderHook(() =>
      useNearestStation({
        officialCoordinates: {},
        onFromChange,
        showToast,
      }),
    );

    act(() => result.current.findNearest());

    expect(onFromChange).toHaveBeenCalledWith("lisova");
    expect(result.current.geoStatus).toBe("ready");
    expect(showToast).toHaveBeenCalledWith("Найближча: Лісова");
    expect(getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  });

  it("reports a geolocation error", () => {
    const showToast = vi.fn();
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (
          _success: PositionCallback,
          error: PositionErrorCallback,
        ) => error({} as GeolocationPositionError),
      },
    });
    const { result } = renderHook(() =>
      useNearestStation({
        officialCoordinates: {},
        onFromChange: vi.fn(),
        showToast,
      }),
    );

    act(() => result.current.findNearest());

    expect(result.current.geoStatus).toBe("error");
    expect(showToast).toHaveBeenCalledWith("Не вдалося отримати геопозицію");
  });
});

describe("route sharing", () => {
  it("creates a clean, self-contained route link", () => {
    const shareData = createRouteShareData({
      baseUrl: "https://metrokyiv.pp.ua/?view=map&station=lisova#route",
      from: "lisova",
      to: "teremky",
      tripMinutes: 42,
    });

    expect(shareData.url).toBe(
      "https://metrokyiv.pp.ua/?from=lisova&to=teremky",
    );
    expect(shareData.text).toBe("Лісова → Теремки, ≈ 42 хв");
  });

  it("copies the route when native sharing is unavailable", async () => {
    const writeText = vi.fn(async () => undefined);
    const showToast = vi.fn();
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    window.history.replaceState({}, "", "/?view=map");
    const { result } = renderHook(() =>
      useShareRoute({
        from: "lisova",
        to: "teremky",
        tripMinutes: 42,
        showToast,
      }),
    );

    await act(() => result.current.shareRoute());

    expect(writeText).toHaveBeenCalledWith(
      "http://localhost:3000/?from=lisova&to=teremky",
    );
    expect(showToast).toHaveBeenCalledWith("Посилання скопійовано");
  });

  it("does not treat a dismissed native share sheet as an error", async () => {
    const showToast = vi.fn();
    vi.stubGlobal("navigator", {
      share: vi.fn(async () => {
        throw new DOMException("Dismissed", "AbortError");
      }),
    });
    const { result } = renderHook(() =>
      useShareRoute({
        from: "lisova",
        to: "teremky",
        tripMinutes: 42,
        showToast,
      }),
    );

    await act(() => result.current.shareRoute());

    expect(showToast).not.toHaveBeenCalled();
  });
});
