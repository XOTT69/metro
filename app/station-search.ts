export function normalizeStationName(value: string) {
  return value
    .toLocaleLowerCase("uk-UA")
    .replace(/[«»"'’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
