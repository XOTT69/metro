import type { TransitCoordinate } from "../transit-router";

export type TransportAlert = {
  id: string;
  title: string;
  text: string;
  publishedAt: string;
  url: string;
  source: string;
};

export type AddressResult = TransitCoordinate & {
  detail: string;
  type: string;
};

export type PanelTab = "plan" | "catalog" | "alerts";
export type CatalogMode =
  | "favorites"
  | "all"
  | "metro"
  | "bus"
  | "trolleybus"
  | "tram"
  | "minibus"
  | "train";

export function isInsideKyiv(point: TransitCoordinate) {
  // A conservative city envelope. The old broad box classified Irpin and
  // Bucha as Kyiv, so regional routes were not highlighted or fitted on map.
  return (
    point.lat >= 50.31 &&
    point.lat <= 50.66 &&
    point.lon >= 30.3 &&
    point.lon <= 30.82
  );
}
