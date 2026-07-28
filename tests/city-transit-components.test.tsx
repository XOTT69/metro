import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import AddressField from "../app/city-transit/AddressField";
import { PlanDetails, PlanServices } from "../app/city-transit/PlanDetails";
import TransitAlertsPanel from "../app/city-transit/TransitAlertsPanel";
import TransitCatalogPanel from "../app/city-transit/TransitCatalogPanel";
import TransitPlanPanel from "../app/city-transit/TransitPlanPanel";
import ActiveJourneyPanel from "../app/city-transit/ActiveJourneyPanel";
import { isInsideKyiv } from "../app/city-transit/model";
import {
  TransitRouteDetails,
  TransitStopDetails,
} from "../app/city-transit/TransitDetailsPanel";
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
        status: "live",
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
    expect(screen.getByText(/≈ 15 хв · 6 зуп\. · до/)).toBeTruthy();
    expect(container.querySelectorAll(".transport-journey > li")).toHaveLength(3);
  });
});

describe("TransitPlanPanel", () => {
  it("lets the rider choose a routing priority", async () => {
    const onRouteProfileChange = vi.fn();
    const onJourneyTimeModeChange = vi.fn();
    const user = userEvent.setup();
    render(
      <TransitPlanPanel
        fromPoint={FROM}
        toPoint={TO}
        regionRouteRequested={false}
        planning={false}
        journeyTimeMode="depart"
        journeyTime="10:30"
        selectedMinute={630}
        plans={[PLAN]}
        activePlan={PLAN}
        activePlanIndex={0}
        routeProfile="fastest"
        hasFavoriteRoutes
        savedPlaces={{ home: null, work: null }}
        onFromSelect={vi.fn()}
        onToSelect={vi.fn()}
        onSwap={vi.fn()}
        onLocate={vi.fn()}
        onStartPicking={vi.fn()}
        onPlanSelect={vi.fn()}
        onRouteProfileChange={onRouteProfileChange}
        onJourneyTimeModeChange={onJourneyTimeModeChange}
        onJourneyTimeChange={vi.fn()}
        onStartJourney={vi.fn()}
        onSavePlace={vi.fn()}
        onRemovePlace={vi.fn()}
        onError={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("radio", { name: "Найшвидше" }).getAttribute("aria-checked"),
    ).toBe("true");
    await user.click(screen.getByRole("radio", { name: "Менше пересадок" }));
    expect(onRouteProfileChange).toHaveBeenCalledWith("fewest-transfers");
    await user.click(screen.getByRole("radio", { name: "Мій транспорт" }));
    expect(onRouteProfileChange).toHaveBeenCalledWith("favorites");
    await user.click(screen.getByRole("radio", { name: "Прибути до" }));
    expect(onJourneyTimeModeChange).toHaveBeenCalledWith("arrive");
  });

  it("uses saved places as either endpoint and can save current endpoints", async () => {
    const onFromSelect = vi.fn();
    const onToSelect = vi.fn();
    const onSavePlace = vi.fn();
    const user = userEvent.setup();
    render(
      <TransitPlanPanel
        fromPoint={FROM}
        toPoint={TO}
        regionRouteRequested={false}
        planning={false}
        journeyTimeMode="depart"
        journeyTime="10:30"
        selectedMinute={630}
        plans={[PLAN]}
        activePlan={PLAN}
        activePlanIndex={0}
        routeProfile="fastest"
        hasFavoriteRoutes={false}
        savedPlaces={{ home: { ...FROM, name: "Мій дім" }, work: null }}
        onFromSelect={onFromSelect}
        onToSelect={onToSelect}
        onSwap={vi.fn()}
        onLocate={vi.fn()}
        onStartPicking={vi.fn()}
        onPlanSelect={vi.fn()}
        onRouteProfileChange={vi.fn()}
        onJourneyTimeModeChange={vi.fn()}
        onJourneyTimeChange={vi.fn()}
        onStartJourney={vi.fn()}
        onSavePlace={onSavePlace}
        onRemovePlace={vi.fn()}
        onError={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Взяти Дім як точку А" }));
    await user.click(screen.getByRole("button", { name: "Взяти Дім як точку Б" }));
    await user.click(screen.getByRole("button", { name: /Дім ← точка А/ }));
    expect(onFromSelect).toHaveBeenCalledWith(expect.objectContaining({ name: "Мій дім" }));
    expect(onToSelect).toHaveBeenCalledWith(expect.objectContaining({ name: "Мій дім" }));
    expect(onSavePlace).toHaveBeenCalledWith("home", FROM);
  });
});

describe("Kyiv region boundary", () => {
  it("does not classify nearby oblast cities as Kyiv", () => {
    expect(isInsideKyiv(FROM)).toBe(true);
    expect(isInsideKyiv({ ...FROM, lat: 50.5218, lon: 30.2506 })).toBe(false);
    expect(isInsideKyiv({ ...FROM, lat: 50.5434, lon: 30.212 })).toBe(false);
  });
});

describe("ActiveJourneyPanel", () => {
  it("keeps the current instruction and manual progress explicit", async () => {
    const onAdvance = vi.fn();
    const onFinish = vi.fn();
    const user = userEvent.setup();
    render(
      <ActiveJourneyPanel
        plan={PLAN}
        legIndex={0}
        startedAt={Date.now()}
        onAdvance={onAdvance}
        onShowMap={vi.fn()}
        onFinish={onFinish}
      />,
    );
    expect(screen.getByText("Сідайте на 24")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Я прибув" }));
    expect(onAdvance).not.toHaveBeenCalled();
    expect(onFinish).toHaveBeenCalledOnce();
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
        counts={{ bus: 1, trolleybus: 0, tram: 0, minibus: 0 }}
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

describe("route and stop details", () => {
  const data: TransitNetworkData = {
    version: 2,
    generatedAt: "2026-07-24",
    source: "test",
    sourceUrl: "https://example.test",
    feedVersion: "2",
    stops: [
      ["a", "Площа", 50.45, 30.52],
      ["b", "Вокзал", 50.44, 30.49],
    ],
    routes: [["taxi:24", "24", "Площа — Вокзал", "minibus", "8a4fc4", "estimated", 10, 20]],
    edges: [[0, 1, 0, 600]],
    patterns: [[0, "Прямий", [0, 1], [[30.52, 50.45], [30.49, 50.44]]]],
  };

  it("opens a route stop and explains data quality", async () => {
    const onStop = vi.fn();
    const user = userEvent.setup();
    render(
      <TransitRouteDetails
        data={data}
        routeIndex={0}
        vehicles={[]}
        alerts={[]}
        favorite={false}
        onFavorite={vi.fn()}
        onClose={vi.fn()}
        onStop={onStop}
      />,
    );
    expect(screen.getByText("час орієнтовний")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Площа/ }));
    expect(onStop).toHaveBeenCalledWith(0);
  });

  it("lists routes serving a stop", async () => {
    const onRoute = vi.fn();
    const user = userEvent.setup();
    render(
      <TransitStopDetails data={data} stopIndex={1} onClose={vi.fn()} onRoute={onRoute} />,
    );
    await user.click(screen.getByRole("button", { name: /24Площа/ }));
    expect(onRoute).toHaveBeenCalledWith(0);
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
