import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import AddressField from "../app/city-transit/AddressField";
import { PlanDetails, PlanServices } from "../app/city-transit/PlanDetails";
import TransitAlertsPanel from "../app/city-transit/TransitAlertsPanel";
import TransitCatalogPanel from "../app/city-transit/TransitCatalogPanel";
import type {
  TransitNetworkData,
  TransitPlace,
  TransitPlan,
} from "../app/transit-router";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const FROM: TransitPlace = {
  id: "from",
  node: 0,
  name: "Хрещатик",
  detail: "Київ",
  mode: "walk",
  lat: 50.4473,
  lon: 30.5229,
};
const TO: TransitPlace = {
  ...FROM,
  id: "to",
  node: 1,
  name: "Вокзал",
  lat: 50.441,
  lon: 30.489,
};
const PLAN: TransitPlan = {
  from: FROM,
  to: TO,
  totalMinutes: 18,
  walkMinutes: 4,
  transfers: 0,
  legs: [
    {
      mode: "bus",
      route: {
        id: "bus-24",
        short: "24",
        long: "Хрещатик — Вокзал",
        mode: "bus",
        color: "#e58a14",
      },
      from: FROM,
      to: TO,
      path: [FROM, TO],
      stops: 6,
      seconds: 720,
      waitSeconds: 180,
    },
  ],
};

describe("AddressField", () => {
  it("debounces geocoding and returns the selected Kyiv-region result", async () => {
    const onSelect = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          results: [
            {
              id: "address:1",
              name: "Хрещатик",
              detail: "Київ, Україна",
              type: "road",
              lat: 50.4473,
              lon: 30.5229,
            },
          ],
        }),
      ),
    );
    const user = userEvent.setup();
    render(
      <AddressField
        marker="A"
        label="Звідки"
        point={null}
        placeholder="Адреса"
        onSelect={onSelect}
        onError={vi.fn()}
      />,
    );

    await user.type(screen.getByRole("combobox", { name: "Звідки" }), "Хрещатик");
    const option = await screen.findByRole("option", { name: /Хрещатик/ }, { timeout: 1500 });
    await user.click(option);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Хрещатик", lat: 50.4473 }),
    );
  });
});

describe("plan details", () => {
  it("renders services and the ordered journey", () => {
    const { container } = render(
      <>
        <PlanServices plan={PLAN} />
        <PlanDetails plan={PLAN} />
      </>,
    );

    expect(screen.getAllByText("24")).toHaveLength(2);
    expect(screen.getByText("Автобус · Хрещатик — Вокзал")).toBeTruthy();
    expect(screen.getByText("≈ 15 хв · 6 зуп.")).toBeTruthy();
    expect(container.querySelectorAll(".transport-journey > li")).toHaveLength(3);
  });
});

describe("TransitCatalogPanel", () => {
  it("keeps mode, route and favorite actions explicit", async () => {
    const data: TransitNetworkData = {
      version: 1,
      generatedAt: "2026-07-23",
      source: "test",
      sourceUrl: "https://example.test",
      feedVersion: "1",
      stops: [],
      routes: [["bus-24", "24", "Хрещатик — Вокзал", "bus", "e58a14"]],
      edges: [],
    };
    const onModeChange = vi.fn();
    const onRoute = vi.fn();
    const onFavorite = vi.fn();
    const user = userEvent.setup();
    render(
      <TransitCatalogPanel
        data={data}
        routeList={[{ route: data.routes[0], index: 0 }]}
        counts={{ bus: 1, trolleybus: 0, tram: 0 }}
        routeMode="all"
        routeQuery=""
        selectedRoute={null}
        selectedMetroLine={null}
        vehicles={[]}
        favoriteRoutes={[]}
        onModeChange={onModeChange}
        onQueryChange={vi.fn()}
        onRoute={onRoute}
        onMetroLine={vi.fn()}
        onFavorite={onFavorite}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Автобус1" }));
    await user.click(screen.getByRole("button", { name: /^24Хрещатик/ }));
    await user.click(screen.getByRole("button", { name: "Додати маршрут в обране" }));
    expect(onModeChange).toHaveBeenCalledWith("bus");
    expect(onRoute).toHaveBeenCalledWith(0);
    expect(onFavorite).toHaveBeenCalledWith("bus-24");
  });
});

describe("TransitAlertsPanel", () => {
  it("renders official changes and notification state", () => {
    render(
      <TransitAlertsPanel
        enabled
        error={false}
        onEnable={vi.fn()}
        alerts={[
          {
            id: "101",
            title: "Зміна руху",
            text: "Автобус курсує за зміненим маршрутом.",
            publishedAt: "2026-07-23T10:00:00Z",
            url: "https://example.test/alert",
            source: "КМДА",
          },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "✓ Увімкнено" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Зміна руху/ })).toBeTruthy();
  });

  it("explains when changes cannot be refreshed", () => {
    render(
      <TransitAlertsPanel
        alerts={[]}
        enabled={false}
        error
        onEnable={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText("Не вдалося оновити зміни")).toBeTruthy();
    expect(screen.getByText(/спробуємо ще раз автоматично/)).toBeTruthy();
  });
});
