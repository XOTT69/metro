import { useEffect, useState } from "react";
import {
  OFFICIAL_GEOJSON_URL,
  STATIONS,
} from "../metro-data";
import { fetchWithTimeout } from "../network/fetchWithTimeout";
import { normalizeStationName } from "../station-search";

export type CoordinateStatus = "loading" | "official" | "fallback";
export type StationCoordinates = Record<string, [number, number]>;

type GeoJsonPayload = {
  features?: Array<{
    properties?: Record<string, unknown>;
    geometry?: { coordinates?: unknown };
  }>;
};

export function parseOfficialMetroCoordinates(
  payload: GeoJsonPayload,
): StationCoordinates {
  const coordinates: StationCoordinates = {};
  const stationsByName = new Map(
    STATIONS.map((station) => [normalizeStationName(station.name), station]),
  );

  for (const feature of payload.features || []) {
    const rawName =
      feature.properties?.name ||
      feature.properties?.NAME ||
      feature.properties?.station_name ||
      "";
    const station = stationsByName.get(normalizeStationName(String(rawName)));
    const point = feature.geometry?.coordinates;
    if (!station || !Array.isArray(point) || point.length < 2) continue;

    const longitude = Number(point[0]);
    const latitude = Number(point[1]);
    if (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= 49 &&
      latitude <= 51.5 &&
      longitude >= 29 &&
      longitude <= 32
    ) {
      coordinates[station.id] = [latitude, longitude];
    }
  }

  return coordinates;
}

export function useOfficialMetroCoordinates() {
  const [coordinates, setCoordinates] = useState<StationCoordinates>({});
  const [status, setStatus] = useState<CoordinateStatus>("loading");

  useEffect(() => {
    const lifecycle = new AbortController();

    void (async () => {
      try {
        const response = await fetchWithTimeout(
          OFFICIAL_GEOJSON_URL,
          { signal: lifecycle.signal },
          10_000,
        );
        if (!response.ok) throw new Error("GeoJSON request failed");
        const nextCoordinates = parseOfficialMetroCoordinates(
          (await response.json()) as GeoJsonPayload,
        );
        if (!Object.keys(nextCoordinates).length) {
          throw new Error("GeoJSON response has no matching stations");
        }
        if (!lifecycle.signal.aborted) {
          setCoordinates(nextCoordinates);
          setStatus("official");
        }
      } catch {
        if (!lifecycle.signal.aborted) setStatus("fallback");
      }
    })();

    return () => lifecycle.abort();
  }, []);

  return {
    coordinates,
    status,
    officialCoordinateCount: Object.keys(coordinates).length,
  };
}
