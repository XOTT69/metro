import { useEffect, useMemo, useRef, useState } from "react";
import {
  createTransitRouter,
  type TransitCoordinate,
  type TransitNetworkData,
  type TransitPlan,
  type TransitRouteProfile,
} from "../../transit-router";

export function useTransitPlanner({
  data,
  from,
  to,
  profile,
  favoriteRoutes,
}: {
  data: TransitNetworkData | null;
  from: TransitCoordinate | null;
  to: TransitCoordinate | null;
  profile: TransitRouteProfile;
  favoriteRoutes: string[];
}) {
  const [plans, setPlans] = useState<TransitPlan[]>([]);
  const [planning, setPlanning] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const requestRef = useRef(0);
  const fallbackRouter = useMemo(
    () => (data && typeof Worker === "undefined" ? createTransitRouter(data) : null),
    [data],
  );

  useEffect(() => {
    if (!data || typeof Worker === "undefined") return;
    const worker = new Worker(new URL("../transit.worker.ts", import.meta.url), {
      type: "module",
      name: "metro-kyiv-transit-router",
    });
    workerRef.current = worker;
    worker.postMessage({ type: "init", data });
    worker.onmessage = ({ data: message }) => {
      if (message.type !== "plans" || message.requestId !== requestRef.current) {
        return;
      }
      setPlans(message.plans);
      setPlanning(false);
    };
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [data]);

  useEffect(() => {
    if (!from || !to || !data) {
      setPlans([]);
      setPlanning(false);
      return;
    }
    const requestId = ++requestRef.current;
    if (fallbackRouter) {
      setPlans(
        fallbackRouter.findPlansBetweenPoints(from, to, 4, {
          profile,
          favoriteRouteIds: new Set(favoriteRoutes),
        }),
      );
      setPlanning(false);
      return;
    }
    setPlanning(true);
    workerRef.current?.postMessage({
      type: "plan",
      requestId,
      from,
      to,
      profile,
      favorites: favoriteRoutes,
    });
  }, [data, fallbackRouter, favoriteRoutes, from, profile, to]);

  return { plans, planning };
}
