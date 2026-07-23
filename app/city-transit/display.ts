import type { TransitMode } from "../transit-router";

export const MODE_ICON: Record<TransitMode, string> = {
  metro: "M",
  bus: "A",
  trolleybus: "Т",
  tram: "Тр",
  regional: "Пр",
  walk: "↟",
};

export const MODE_COLOR: Record<TransitMode, string> = {
  metro: "#0a865b",
  bus: "#e58a14",
  trolleybus: "#2576d2",
  tram: "#d83d50",
  regional: "#7043c5",
  walk: "#68736e",
};
