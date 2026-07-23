import { useCallback } from "react";
import { STATION_BY_ID } from "../metro-data";

export function createRouteShareData({
  baseUrl,
  from,
  to,
  tripMinutes,
}: {
  baseUrl: string;
  from: string;
  to: string;
  tripMinutes: number;
}) {
  const url = new URL(baseUrl);
  url.search = "";
  url.hash = "";
  url.searchParams.set("from", from);
  url.searchParams.set("to", to);
  return {
    title: "Маршрут у Metro Kyiv",
    text: `${STATION_BY_ID[from].name} → ${STATION_BY_ID[to].name}, ≈ ${tripMinutes} хв`,
    url: url.toString(),
  };
}

export function useShareRoute({
  from,
  to,
  tripMinutes,
  showToast,
}: {
  from: string;
  to: string;
  tripMinutes: number;
  showToast: (message: string) => void;
}) {
  const shareRoute = useCallback(async () => {
    const shareData = createRouteShareData({
      baseUrl: window.location.href,
      from,
      to,
      tripMinutes,
    });
    const canShare = typeof navigator.share === "function";

    try {
      if (canShare) await navigator.share(shareData);
      else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareData.url);
      } else {
        throw new Error("Clipboard is unavailable");
      }
      showToast(
        canShare ? "Маршрут готовий до поширення" : "Посилання скопійовано",
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      showToast("Не вдалося поширити маршрут");
    }
  }, [from, showToast, to, tripMinutes]);

  return { shareRoute };
}
