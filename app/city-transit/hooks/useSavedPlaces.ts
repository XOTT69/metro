import { useEffect, useState } from "react";
import type { TransitCoordinate } from "../../transit-router";

export type SavedPlaceKind = "home" | "work";
export type SavedPlaces = Record<SavedPlaceKind, TransitCoordinate | null>;

const STORAGE_KEY = "metro-kyiv:saved-places";
const EMPTY_PLACES: SavedPlaces = { home: null, work: null };

function readSavedPlaces(): SavedPlaces {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      home: value.home && typeof value.home.name === "string" ? value.home : null,
      work: value.work && typeof value.work.name === "string" ? value.work : null,
    };
  } catch {
    return EMPTY_PLACES;
  }
}

export function useSavedPlaces() {
  const [places, setPlaces] = useState<SavedPlaces>(readSavedPlaces);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
  }, [places]);

  const savePlace = (kind: SavedPlaceKind, point: TransitCoordinate) => {
    setPlaces((current) => ({ ...current, [kind]: point }));
  };

  const removePlace = (kind: SavedPlaceKind) => {
    setPlaces((current) => ({ ...current, [kind]: null }));
  };

  return { places, savePlace, removePlace };
}
