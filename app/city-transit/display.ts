import type { TransitMode } from "../transit-router";

export const MODE_ICON: Record<TransitMode, string> = {
  metro: "M",
  bus: "A",
  trolleybus: "Т",
  tram: "Тр",
  minibus: "Мр",
  train: "Е",
  funicular: "Ф",
  regional: "Пр",
  walk: "↟",
};

export const MODE_COLOR: Record<TransitMode, string> = {
  metro: "#0a865b",
  bus: "#e58a14",
  trolleybus: "#2576d2",
  tram: "#d83d50",
  minibus: "#8a4fc4",
  train: "#5465b8",
  funicular: "#0d8c83",
  regional: "#7043c5",
  walk: "#68736e",
};
