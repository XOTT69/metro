/// <reference lib="webworker" />

import {
  createTransitRouter,
  type TransitCoordinate,
  type TransitNetworkData,
  type TransitRouteProfile,
} from "../transit-router";

let router: ReturnType<typeof createTransitRouter> | null = null;

type WorkerMessage =
  | { type: "init"; data: TransitNetworkData }
  | {
      type: "plan";
      requestId: number;
      from: TransitCoordinate;
      to: TransitCoordinate;
      profile: TransitRouteProfile;
      favorites: string[];
    };

self.onmessage = ({ data }: MessageEvent<WorkerMessage>) => {
  if (data.type === "init") {
    router = createTransitRouter(data.data);
    self.postMessage({ type: "ready" });
    return;
  }
  if (!router) return;
  const plans = router.findPlansBetweenPoints(data.from, data.to, 4, {
    profile: data.profile,
    favoriteRouteIds: new Set(data.favorites),
  });
  self.postMessage({ type: "plans", requestId: data.requestId, plans });
};

export {};
