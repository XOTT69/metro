import type { LiveVehicle } from "../gtfs-realtime";
import type { TransitPlan } from "../transit-router";

export function getVisibleVehicleRouteIds({
  favoriteRouteIds,
  selectedRouteId,
  activePlan,
}: {
  favoriteRouteIds: readonly string[];
  selectedRouteId: string | null;
  activePlan: TransitPlan | null;
}) {
  const routeIds = new Set(favoriteRouteIds);
  if (selectedRouteId) routeIds.add(selectedRouteId);
  activePlan?.legs.forEach((leg) => {
    if (leg.route?.id) routeIds.add(leg.route.id);
  });
  return routeIds;
}

export function filterVisibleVehicles(
  vehicles: readonly LiveVehicle[],
  routeIds: ReadonlySet<string>,
) {
  if (!routeIds.size) return [];
  return vehicles.filter((vehicle) => routeIds.has(vehicle.routeId));
}
