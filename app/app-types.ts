export const VIEW_IDS = [
  "planner",
  "city",
  "map",
  "stations",
  "settings",
] as const;

export type View = (typeof VIEW_IDS)[number];
export type Theme = "system" | "light" | "dark";
export type GeoStatus = "idle" | "loading" | "ready" | "error";

export const DESKTOP_NAV: readonly (readonly [View, string])[] = [
  ["planner", "Маршрут"],
  ["city", "Увесь транспорт"],
  ["map", "Схема"],
  ["stations", "Станції й таймери"],
  ["settings", "Налаштування"],
];

export const MOBILE_NAV: readonly (readonly [View, string, string])[] = [
  ["planner", "⌁", "Маршрут"],
  ["city", "≋", "Транспорт"],
  ["map", "◇", "Схема"],
  ["stations", "◷", "Таймери"],
  ["settings", "⚙", "Параметри"],
];

export function isView(value: string | null): value is View {
  return value !== null && VIEW_IDS.some((view) => view === value);
}
