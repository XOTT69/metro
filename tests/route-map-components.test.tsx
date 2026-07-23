import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import MetroMap from "../app/components/MetroMap";
import OfficialMapViewer from "../app/components/OfficialMapViewer";
import {
  RouteItinerary,
  RouteJourney,
} from "../app/components/RouteDetails";
import { getRoute } from "../app/metro-data";

afterEach(() => {
  cleanup();
});

describe("route details", () => {
  it("marks line changes and opens a station from the itinerary", async () => {
    const onStation = vi.fn();
    const user = userEvent.setup();
    render(
      <RouteItinerary
        route={["khreshchatyk", "maidan-nezalezhnosti"]}
        onStation={onStation}
      />,
    );

    expect(screen.getByText("Пересадка на M2")).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: /Майдан Незалежності/ }),
    );
    expect(onStation).toHaveBeenCalledWith("maidan-nezalezhnosti");
  });

  it("groups a cross-line route into ordered journey legs", () => {
    render(
      <RouteJourney
        route={getRoute("akademmistechko", "teremky")}
        onStation={vi.fn()}
      />,
    );

    expect(screen.getByText("1 пересадка")).toBeTruthy();
    expect(screen.getByText("Перейдіть на M2")).toBeTruthy();
    expect(screen.getByText("у напрямку Теремки")).toBeTruthy();
  });
});

describe("metro maps", () => {
  it("keeps all stations keyboard-operable and changes zoom", async () => {
    const onStation = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <MetroMap
        route={["khreshchatyk", "maidan-nezalezhnosti"]}
        onStation={onStation}
      />,
    );

    expect(container.querySelectorAll(".map-station")).toHaveLength(52);
    expect(screen.getByText("74%")).toBeTruthy();

    await user.click(
      screen.getByRole("button", { name: /^Хрещатик,/ }),
    );
    expect(onStation).toHaveBeenCalledWith("khreshchatyk");

    await user.click(
      screen.getByRole("button", { name: "Збільшити масштаб" }),
    );
    expect(screen.getByText("84%")).toBeTruthy();
  });

  it("zooms and resets the high-resolution official map", async () => {
    const user = userEvent.setup();
    render(<OfficialMapViewer />);

    expect(screen.getByText("100%")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Збільшити карту" }));
    expect(screen.getByText("125%")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Вписати" }));
    expect(screen.getByText("100%")).toBeTruthy();
  });
});
