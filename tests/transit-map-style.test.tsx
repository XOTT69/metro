import { describe, expect, it } from "vitest";
import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import { CITY_STYLE } from "../app/TransitMap";

describe("current vector basemap", () => {
  it("is a valid MapLibre style", () => {
    expect(validateStyleMin(CITY_STYLE)).toEqual([]);
  });
});
