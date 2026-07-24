import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import MapView from "../app/views/MapView";
import PlannerView from "../app/views/PlannerView";
import SettingsView from "../app/views/SettingsView";
import StationsView from "../app/views/StationsView";

afterEach(() => {
  cleanup();
});

describe("PlannerView", () => {
  it("keeps route actions connected through explicit props", async () => {
    const onOpenMap = vi.fn();
    const onShare = vi.fn();
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(
      <PlannerView
        from="khreshchatyk"
        to="maidan-nezalezhnosti"
        route={["khreshchatyk", "maidan-nezalezhnosti"]}
        tripMinutes={7}
        transfers={1}
        saved={false}
        geoStatus="idle"
        onFromChange={vi.fn()}
        onToChange={vi.fn()}
        onSwap={vi.fn()}
        onFindNearest={vi.fn()}
        onOpenMap={onOpenMap}
        onShare={onShare}
        onSave={onSave}
        onStation={vi.fn()}
      />,
    );

    expect(screen.getByText("≈ 7 хв")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Відкрити велику схему" }));
    await user.click(screen.getByRole("button", { name: "Поділитися" }));
    await user.click(screen.getByRole("button", { name: "☆ Зберегти" }));
    expect(onOpenMap).toHaveBeenCalledOnce();
    expect(onShare).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledOnce();
  });
});

describe("MapView", () => {
  it("renders both map modes and returns to the planner", async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(
      <MapView
        from="khreshchatyk"
        to="maidan-nezalezhnosti"
        route={["khreshchatyk", "maidan-nezalezhnosti"]}
        tripMinutes={7}
        transfers={1}
        onFromChange={vi.fn()}
        onToChange={vi.fn()}
        onSwap={vi.fn()}
        onBack={onBack}
        onStation={vi.fn()}
      />,
    );

    expect(screen.getByText("Карта високої якості")).toBeTruthy();
    expect(screen.getByText("Інтерактивний маршрут")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "← До маршруту" }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});

describe("StationsView", () => {
  it("filters stations locally and preserves favorite actions", async () => {
    const onFavorite = vi.fn();
    const user = userEvent.setup();
    render(
      <StationsView
        favorites={[]}
        savedRoutes={[]}
        recentRoutes={[]}
        onStation={vi.fn()}
        onFavorite={onFavorite}
        onJourney={vi.fn()}
        onRemoveSaved={vi.fn()}
      />,
    );

    await user.type(screen.getByRole("searchbox"), "Золоті ворота");
    expect(screen.getByText("Знайдено:").parentElement?.textContent).toContain("1");
    await user.click(
      screen.getByRole("button", { name: "Додати Золоті ворота в обране" }),
    );
    expect(onFavorite).toHaveBeenCalledWith("zoloti-vorota");
  });

  it("opens and removes a saved journey from the personal area", async () => {
    const onJourney = vi.fn();
    const onRemoveSaved = vi.fn();
    const user = userEvent.setup();
    render(
      <StationsView
        favorites={["lisova"]}
        savedRoutes={[{ from: "lisova", to: "teremky", usedAt: 10 }]}
        recentRoutes={[]}
        onStation={vi.fn()}
        onFavorite={vi.fn()}
        onJourney={onJourney}
        onRemoveSaved={onRemoveSaved}
      />,
    );

    await user.click(screen.getByText("Лісова → Теремки"));
    expect(onJourney).toHaveBeenCalledWith("lisova", "teremky");
    await user.click(
      screen.getByRole("button", { name: "Видалити маршрут Лісова — Теремки" }),
    );
    expect(onRemoveSaved).toHaveBeenCalledWith("lisova", "teremky");
  });
});

describe("SettingsView", () => {
  it("reports theme changes without owning persisted state", async () => {
    const onThemeChange = vi.fn();
    const user = userEvent.setup();
    render(
      <SettingsView
        theme="system"
        coordinateStatus="official"
        officialCoordinateCount={52}
        onThemeChange={onThemeChange}
        onInstall={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("radio", { name: "◐ Системна" }).getAttribute("aria-checked"),
    ).toBe("true");
    expect(screen.getByText("Офіційні координати · 52/52")).toBeTruthy();
    await user.click(screen.getByRole("radio", { name: "☾ Темна" }));
    expect(onThemeChange).toHaveBeenCalledWith("dark");
  });

  it("makes the offline coordinate fallback visible", () => {
    render(
      <SettingsView
        theme="system"
        coordinateStatus="fallback"
        officialCoordinateCount={0}
        onThemeChange={vi.fn()}
        onInstall={vi.fn()}
      />,
    );

    expect(screen.getByText("Локальні координати · 52/52")).toBeTruthy();
    expect(screen.getByText(/GeoJSON API зараз недоступний/)).toBeTruthy();
  });
});
