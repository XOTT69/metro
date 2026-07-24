import { useCallback, useState } from "react";
import type { GeoStatus } from "../app-types";
import { STATIONS, type Station } from "../metro-data";
import type { StationCoordinates } from "./useOfficialMetroCoordinates";

function distanceMeters(
  latitude: number,
  longitude: number,
  stationLatitude: number,
  stationLongitude: number,
) {
  const latitudeScale = 111_320;
  const longitudeScale =
    Math.cos(((latitude + stationLatitude) * Math.PI) / 360) * latitudeScale;
  return Math.hypot(
    (latitude - stationLatitude) * latitudeScale,
    (longitude - stationLongitude) * longitudeScale,
  );
}

export function getNearestStation(
  latitude: number,
  longitude: number,
  officialCoordinates: StationCoordinates = {},
): Station {
  return STATIONS.reduce(
    (best, station) => {
      const [stationLatitude, stationLongitude] = officialCoordinates[
        station.id
      ] || [station.lat, station.lon];
      const distance = distanceMeters(
        latitude,
        longitude,
        stationLatitude,
        stationLongitude,
      );
      return distance < best.distance ? { station, distance } : best;
    },
    { station: STATIONS[0], distance: Infinity },
  ).station;
}

export function useNearestStation({
  officialCoordinates,
  onFromChange,
  showToast,
}: {
  officialCoordinates: StationCoordinates;
  onFromChange: (stationId: string) => void;
  showToast: (message: string) => void;
}) {
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");

  const findNearest = useCallback(() => {
    if (!navigator.geolocation) {
      showToast("Геолокація не підтримується цим браузером");
      return;
    }

    setGeoStatus("loading");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const nearest = getNearestStation(
          coords.latitude,
          coords.longitude,
          officialCoordinates,
        );
        onFromChange(nearest.id);
        setGeoStatus("ready");
        showToast(`Найближча: ${nearest.name}`);
      },
      () => {
        setGeoStatus("error");
        showToast("Не вдалося отримати геопозицію");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, [
    officialCoordinates,
    onFromChange,
    showToast,
  ]);

  return { geoStatus, findNearest };
}
