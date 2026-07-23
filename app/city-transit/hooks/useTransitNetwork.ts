import { useEffect, useState } from "react";
import type { TransitNetworkData } from "../../transit-router";
import { fetchWithTimeout } from "../../network/fetchWithTimeout";

export function useTransitNetwork() {
  const [data, setData] = useState<TransitNetworkData | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const lifecycle = new AbortController();

    void (async () => {
      try {
        const response = await fetchWithTimeout(
          "/transit-network.json",
          { signal: lifecycle.signal },
          12_000,
        );
        if (!response.ok) throw new Error("Transit network request failed");
        const network = (await response.json()) as TransitNetworkData;
        if (!lifecycle.signal.aborted) {
          setData(network);
          setLoadError(false);
        }
      } catch {
        if (!lifecycle.signal.aborted) setLoadError(true);
      }
    })();

    return () => lifecycle.abort();
  }, []);

  return { data, loadError };
}
