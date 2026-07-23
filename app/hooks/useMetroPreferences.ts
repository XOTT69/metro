import { useEffect, useState } from "react";
import type { Theme } from "../app-types";
import { STATION_BY_ID } from "../metro-data";

const STORAGE = {
  favorites: "metro-kyiv:favorites",
  theme: "metro-kyiv:theme",
  timerStation: "metro-kyiv:timer-station",
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

function readTimerStation() {
  const station = readStorage(STORAGE.timerStation);
  return station && STATION_BY_ID[station] ? station : "maidan-nezalezhnosti";
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

export function useMetroPreferences() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [favorites, setFavorites] = useState<string[]>(readFavorites);
  const [timerStation, setTimerStation] = useState(readTimerStation);

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
    writeStorage(STORAGE.timerStation, timerStation);
  }, [timerStation]);

  return {
    theme,
    setTheme,
    favorites,
    setFavorites,
    timerStation,
    setTimerStation,
  };
}
