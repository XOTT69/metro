import { useEffect, useState } from "react";
import type { TransportAlert } from "../model";
import { fetchWithTimeout } from "./fetchWithTimeout";

const ALERT_UPDATE_INTERVAL_MS = 300_000;

export function useTransportAlerts() {
  const [alerts, setAlerts] = useState<TransportAlert[]>([]);
  const [alertsError, setAlertsError] = useState(false);

  useEffect(() => {
    const lifecycle = new AbortController();
    let requestPending = false;

    const updateAlerts = async () => {
      if (requestPending) return;
      requestPending = true;
      try {
        const response = await fetchWithTimeout(
          "/api/alerts",
          { signal: lifecycle.signal },
          10_000,
        );
        if (!response.ok) throw new Error("Alert request failed");
        const payload = (await response.json()) as {
          alerts?: TransportAlert[];
        };
        if (!Array.isArray(payload.alerts)) {
          throw new Error("Invalid alert response");
        }
        if (!lifecycle.signal.aborted) {
          setAlerts(payload.alerts);
          setAlertsError(false);
        }
      } catch {
        if (!lifecycle.signal.aborted) setAlertsError(true);
      } finally {
        requestPending = false;
      }
    };

    void updateAlerts();
    const interval = window.setInterval(
      () => void updateAlerts(),
      ALERT_UPDATE_INTERVAL_MS,
    );

    return () => {
      lifecycle.abort();
      window.clearInterval(interval);
    };
  }, []);

  return { alerts, alertsError };
}
