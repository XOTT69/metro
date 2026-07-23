import { useCallback, useEffect, useState } from "react";
import { isView, type View } from "../app-types";
import { STATION_BY_ID } from "../metro-data";

const DEFAULT_FROM = "akademmistechko";
const DEFAULT_TO = "maidan-nezalezhnosti";

export type MetroNavigationState = {
  from: string;
  to: string;
  view: View;
  activeStation: string | null;
};

export function parseMetroNavigation(search: string): MetroNavigationState {
  const params = new URLSearchParams(search);
  const from = params.get("from");
  const to = params.get("to");
  const station = params.get("station");
  const view = params.get("view");

  return {
    from: from && STATION_BY_ID[from] ? from : DEFAULT_FROM,
    to: to && STATION_BY_ID[to] ? to : DEFAULT_TO,
    view: isView(view) ? view : "planner",
    activeStation: station && STATION_BY_ID[station] ? station : null,
  };
}

function replaceNavigationUrl(state: MetroNavigationState) {
  const url = new URL(window.location.href);
  const values: Array<[string, string | null, string | null]> = [
    ["from", state.from, DEFAULT_FROM],
    ["to", state.to, DEFAULT_TO],
    ["view", state.view, "planner"],
    ["station", state.activeStation, null],
  ];

  for (const [key, value, defaultValue] of values) {
    if (value === null || value === defaultValue) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, "", nextUrl);
  }
}

export function useMetroNavigation() {
  const [navigation, setNavigation] = useState<MetroNavigationState>(() =>
    parseMetroNavigation(window.location.search),
  );

  useEffect(() => {
    const onPopState = () => {
      setNavigation(parseMetroNavigation(window.location.search));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    replaceNavigationUrl(navigation);
  }, [navigation]);

  const setFrom = useCallback((from: string) => {
    if (STATION_BY_ID[from]) {
      setNavigation((current) => ({ ...current, from }));
    }
  }, []);

  const setTo = useCallback((to: string) => {
    if (STATION_BY_ID[to]) {
      setNavigation((current) => ({ ...current, to }));
    }
  }, []);

  const swap = useCallback(() => {
    setNavigation((current) => ({
      ...current,
      from: current.to,
      to: current.from,
    }));
  }, []);

  const chooseView = useCallback((view: View) => {
    setNavigation((current) => ({ ...current, view }));
  }, []);

  const openStation = useCallback((activeStation: string) => {
    if (STATION_BY_ID[activeStation]) {
      setNavigation((current) => ({ ...current, activeStation }));
    }
  }, []);

  const closeStation = useCallback(() => {
    setNavigation((current) => ({ ...current, activeStation: null }));
  }, []);

  return {
    ...navigation,
    setFrom,
    setTo,
    swap,
    chooseView,
    openStation,
    closeStation,
  };
}
