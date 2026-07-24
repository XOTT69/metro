import { describe, expect, it } from "vitest";
import type { LiveVehicle } from "../app/gtfs-realtime";
import type { TransitPlan } from "../app/transit-router";
import {
  filterVisibleVehicles,
  getVisibleVehicleRouteIds,
} from "../app/city-transit/vehicle-visibility";

const vehicles: LiveVehicle[] = [
  {
    id: "vehicle-24",
    routeId: "bus-24",
    label: "24",
    latitude: 50.45,
    longitude: 30.52,
    bearing: 90,
    speed: 8,
    timestamp: 1,
  },
  {
    id: "vehicle-18",
    routeId: "tram-18",
    label: "18",
    latitude: 50.46,
    longitude: 30.51,
    bearing: 180,
    speed: 6,
    timestamp: 1,
  },
  {
    id: "vehicle-38",
    routeId: "trolley-38",
    label: "38",
    latitude: 50.44,
    longitude: 30.53,
    bearing: 270,
    speed: 7,
    timestamp: 1,
  },
];

const plan = {
  legs: [
    { route: { id: "tram-18" } },
    { route: null },
  ],
} as unknown as TransitPlan;

describe("favorite vehicle visibility", () => {
  it("shows no vehicles before a route is favorited or selected", () => {
    const routeIds = getVisibleVehicleRouteIds({
      favoriteRouteIds: [],
      selectedRouteId: null,
      activePlan: null,
    });

    expect(filterVisibleVehicles(vehicles, routeIds)).toEqual([]);
  });

  it("combines favorites, the selected route and active journey routes", () => {
    const routeIds = getVisibleVehicleRouteIds({
      favoriteRouteIds: ["bus-24"],
      selectedRouteId: "trolley-38",
      activePlan: plan,
    });

    expect([...routeIds]).toEqual(["bus-24", "trolley-38", "tram-18"]);
    expect(filterVisibleVehicles(vehicles, routeIds).map(({ id }) => id)).toEqual([
      "vehicle-24",
      "vehicle-18",
      "vehicle-38",
    ]);
  });

  it("does not duplicate a route shared by favorites and a journey", () => {
    const routeIds = getVisibleVehicleRouteIds({
      favoriteRouteIds: ["tram-18"],
      selectedRouteId: "tram-18",
      activePlan: plan,
    });

    expect([...routeIds]).toEqual(["tram-18"]);
  });
});
