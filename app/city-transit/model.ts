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
  return (
    point.lat >= 50.2 &&
    point.lat <= 50.68 &&
    point.lon >= 30.18 &&
    point.lon <= 30.9
  );
}
