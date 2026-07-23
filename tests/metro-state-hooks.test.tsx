import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  parseMetroNavigation,
  useMetroNavigation,
} from "../app/hooks/useMetroNavigation";
import { useMetroPreferences } from "../app/hooks/useMetroPreferences";

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  window.history.replaceState({}, "", "/");
});

describe("metro navigation state", () => {
  it("validates route, view and station query parameters", () => {
    expect(
      parseMetroNavigation(
        "?from=lisova&to=teremky&view=map&station=khreshchatyk",
      ),
    ).toEqual({
      from: "lisova",
      to: "teremky",
      view: "map",
      activeStation: "khreshchatyk",
    });
    expect(
      parseMetroNavigation("?from=unknown&to=missing&view=broken&station=nope"),
    ).toEqual({
      from: "akademmistechko",
      to: "maidan-nezalezhnosti",
      view: "planner",
      activeStation: null,
    });
  });

  it("initializes synchronously and keeps route changes in one URL", async () => {
    window.history.replaceState({}, "", "/?from=lisova&view=map&campaign=pwa");
    const { result } = renderHook(() => useMetroNavigation());

    expect(result.current.from).toBe("lisova");
    expect(result.current.view).toBe("map");

    act(() => {
      result.current.setTo("teremky");
      result.current.openStation("khreshchatyk");
      result.current.chooseView("stations");
    });

    await waitFor(() => {
      const params = new URLSearchParams(window.location.search);
      expect(params.get("from")).toBe("lisova");
      expect(params.get("to")).toBe("teremky");
      expect(params.get("station")).toBe("khreshchatyk");
      expect(params.get("view")).toBe("stations");
      expect(params.get("campaign")).toBe("pwa");
    });

    act(() => result.current.swap());
    expect(result.current.from).toBe("teremky");
    expect(result.current.to).toBe("lisova");
  });

  it("restores state when browser history changes", async () => {
    const { result } = renderHook(() => useMetroNavigation());

    act(() => {
      window.history.pushState(
        {},
        "",
        "/?view=settings&station=zoloti-vorota",
      );
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    await waitFor(() => {
      expect(result.current.view).toBe("settings");
      expect(result.current.activeStation).toBe("zoloti-vorota");
    });
  });
});

describe("metro preferences", () => {
  it("reads and sanitizes persisted preferences before the first render", () => {
    localStorage.setItem("metro-kyiv:theme", "dark");
    localStorage.setItem("metro-kyiv:timer-station", "lisova");
    localStorage.setItem(
      "metro-kyiv:favorites",
      JSON.stringify(["lisova", "invalid", "lisova", "teremky"]),
    );

    const { result } = renderHook(() => useMetroPreferences());

    expect(result.current.theme).toBe("dark");
    expect(result.current.timerStation).toBe("lisova");
    expect(result.current.favorites).toEqual(["lisova", "teremky"]);
  });

  it("persists updates and applies the selected theme", async () => {
    const { result } = renderHook(() => useMetroPreferences());

    act(() => {
      result.current.setTheme("light");
      result.current.setTimerStation("teremky");
      result.current.setFavorites(["teremky"]);
    });

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("light");
      expect(localStorage.getItem("metro-kyiv:theme")).toBe("light");
      expect(localStorage.getItem("metro-kyiv:timer-station")).toBe("teremky");
      expect(localStorage.getItem("metro-kyiv:favorites")).toBe(
        JSON.stringify(["teremky"]),
      );
    });
  });
});
