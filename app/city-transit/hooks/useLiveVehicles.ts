import { useEffect, useState } from "react";
import {
  decodeGtfsRealtime,
  type LiveVehicle,
} from "../../gtfs-realtime";
import { fetchWithTimeout } from "./fetchWithTimeout";

const LIVE_UPDATE_INTERVAL_MS = 30_000;

export function useLiveVehicles() {
  const [vehicles, setVehicles] = useState<LiveVehicle[]>([]);
  const [liveUpdatedAt, setLiveUpdatedAt] = useState<Date | null>(null);
  const [liveError, setLiveError] = useState(false);

  useEffect(() => {
    const lifecycle = new AbortController();
    let requestPending = false;

    const updateVehicles = async () => {
      if (requestPending) return;
      requestPending = true;
      try {
        const response = await fetchWithTimeout(
          "/api/realtime",
          { signal: lifecycle.signal },
          10_000,
        );
        if (!response.ok) throw new Error("Realtime request failed");
        const nextVehicles = decodeGtfsRealtime(await response.arrayBuffer());
        if (lifecycle.signal.aborted) return;

        const latestTimestamp = nextVehicles.reduce(
          (latest, vehicle) => Math.max(latest, vehicle.timestamp),
          0,
        );
        setVehicles(nextVehicles);
        setLiveUpdatedAt(
          latestTimestamp ? new Date(latestTimestamp * 1_000) : new Date(),
        );
        setLiveError(false);
      } catch {
        if (!lifecycle.signal.aborted) setLiveError(true);
      } finally {
        requestPending = false;
      }
    };

    void updateVehicles();
    const interval = window.setInterval(
      () => void updateVehicles(),
      LIVE_UPDATE_INTERVAL_MS,
    );

    return () => {
      lifecycle.abort();
      window.clearInterval(interval);
    };
  }, []);

  return { vehicles, liveUpdatedAt, liveError };
}
