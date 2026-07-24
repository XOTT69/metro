import { useCallback, useEffect, useState } from "react";
import type { SavedMetroRoute, Theme } from "../app-types";
import { STATION_BY_ID } from "../metro-data";

const STORAGE = {
  favorites: "metro-kyiv:favorites",
  theme: "metro-kyiv:theme",
  savedRoutes: "metro-kyiv:saved-metro-routes",
  recentRoutes: "metro-kyiv:recent-metro-routes",
} as const;

function readStorage(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The application remains usable when private browsing blocks storage.
  }
}

function readTheme(): Theme {
  const theme = readStorage(STORAGE.theme);
  return theme === "light" || theme === "dark" || theme === "system"
    ? theme
    : "system";
}

function readFavorites() {
  try {
    const parsed: unknown = JSON.parse(readStorage(STORAGE.favorites) || "[]");
    if (!Array.isArray(parsed)) return [];
    return [
      ...new Set(
        parsed.filter(
          (id): id is string =>
            typeof id === "string" && Boolean(STATION_BY_ID[id]),
        ),
      ),
    ];
  } catch {
    return [];
  }
}

function readRoutes(key: string) {
  try {
    const parsed: unknown = JSON.parse(readStorage(key) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (route): route is SavedMetroRoute =>
          typeof route === "object" &&
          route !== null &&
          "from" in route &&
          "to" in route &&
          "usedAt" in route &&
          typeof route.from === "string" &&
          typeof route.to === "string" &&
          typeof route.usedAt === "number" &&
          Boolean(STATION_BY_ID[route.from]) &&
          Boolean(STATION_BY_ID[route.to]) &&
          route.from !== route.to,
      )
      .slice(0, 8);
  } catch {
    return [];
  }
}

export function useMetroPreferences() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [favorites, setFavorites] = useState<string[]>(readFavorites);
  const [savedRoutes, setSavedRoutes] = useState<SavedMetroRoute[]>(() =>
    readRoutes(STORAGE.savedRoutes),
  );
  const [recentRoutes, setRecentRoutes] = useState<SavedMetroRoute[]>(() =>
    readRoutes(STORAGE.recentRoutes),
  );

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
    writeStorage(STORAGE.theme, theme);
  }, [theme]);

  useEffect(() => {
    writeStorage(STORAGE.favorites, JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    writeStorage(STORAGE.savedRoutes, JSON.stringify(savedRoutes));
  }, [savedRoutes]);

  useEffect(() => {
    writeStorage(STORAGE.recentRoutes, JSON.stringify(recentRoutes));
  }, [recentRoutes]);

  const rememberRoute = useCallback((from: string, to: string) => {
    if (from === to || !STATION_BY_ID[from] || !STATION_BY_ID[to]) return;
    setRecentRoutes((current) => [
      { from, to, usedAt: Date.now() },
      ...current.filter((route) => route.from !== from || route.to !== to),
    ].slice(0, 6));
  }, []);

  return {
    theme,
    setTheme,
    favorites,
    setFavorites,
    savedRoutes,
    setSavedRoutes,
    recentRoutes,
    rememberRoute,
  };
}
