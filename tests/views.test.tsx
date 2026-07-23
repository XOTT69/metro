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
    const user = userEvent.setup();
    render(
      <PlannerView
        from="khreshchatyk"
        to="maidan-nezalezhnosti"
        route={["khreshchatyk", "maidan-nezalezhnosti"]}
        tripMinutes={7}
        transfers={1}
        timerStation="maidan-nezalezhnosti"
        geoStatus="idle"
        onFromChange={vi.fn()}
        onToChange={vi.fn()}
        onSwap={vi.fn()}
        onFindNearest={vi.fn()}
        onOpenMap={onOpenMap}
        onShare={onShare}
        onStation={vi.fn()}
        onTrack={vi.fn()}
      />,
    );

    expect(screen.getByText("≈ 7 хв")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Відкрити велику схему" }));
    await user.click(screen.getByRole("button", { name: "Поділитися" }));
    expect(onOpenMap).toHaveBeenCalledOnce();
    expect(onShare).toHaveBeenCalledOnce();
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
        timerStation="maidan-nezalezhnosti"
        onStation={vi.fn()}
        onTrack={vi.fn()}
        onFavorite={onFavorite}
      />,
    );

    await user.type(screen.getByRole("searchbox"), "Золоті ворота");
    expect(screen.getByText("Знайдено:").parentElement?.textContent).toContain("1");
    await user.click(
      screen.getByRole("button", { name: "Додати Золоті ворота в обране" }),
    );
    expect(onFavorite).toHaveBeenCalledWith("zoloti-vorota");
  });
});

describe("SettingsView", () => {
  it("reports theme changes without owning persisted state", async () => {
    const onThemeChange = vi.fn();
    const user = userEvent.setup();
    render(
      <SettingsView
        theme="system"
        onThemeChange={onThemeChange}
        onInstall={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("radio", { name: "◐ Системна" }).getAttribute("aria-checked"),
    ).toBe("true");
    await user.click(screen.getByRole("radio", { name: "☾ Темна" }));
    expect(onThemeChange).toHaveBeenCalledWith("dark");
  });
});
