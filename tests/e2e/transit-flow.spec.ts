import { expect, test } from "@playwright/test";

test("transport navigator opens route details and leaves the map usable", async ({
  page,
}, testInfo) => {
  await page.goto("/?view=city");
  await expect(page.locator(".transport-hub-shell")).toBeVisible();
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect(page.locator(".maplibregl-ctrl-attrib")).toContainText(
    "OpenStreetMap",
  );

  const networkResponse = await page.request.get("/transit-network.json");
  expect(networkResponse.ok()).toBeTruthy();
  const network = await networkResponse.json();
  expect(network.version).toBe(2);
  expect(network.routes.length).toBeGreaterThanOrEqual(265);
  expect(network.patterns.length).toBeGreaterThanOrEqual(500);
  expect(network.departures.length).toBeGreaterThanOrEqual(1_400);

  const transportTab = page
    .locator(".transport-panel-tabs")
    .getByRole("tab", { name: "Транспорт" });
  if (await transportTab.isVisible()) await transportTab.click();
  else {
    await page
      .locator(".transport-bottom-nav")
      .getByRole("button", { name: /Транспорт/ })
      .click();
  }
  await page.getByRole("button", { name: /Маршрутки/ }).click();
  await expect(page.getByText(/107 маршрут/)).toBeVisible();
  await page.locator(".transport-route-list > div > button:first-child").first().click();
  await expect(page.locator(".transport-route-details")).toBeVisible();
  await expect(page.locator(".transport-data-quality")).toContainText(
    /розкладом|орієнтовний|реєстр/,
  );

  const collapse = page.locator(
    ".transport-panel-collapse:visible, .transport-sheet-handle:visible",
  );
  await collapse.first().click();
  await expect(page.locator(".transport-hub-panel")).toHaveClass(/is-closed/);
  await expect(page.locator(".transport-selected-card")).toBeVisible();

  if (testInfo.project.name === "mobile-chromium") {
    const bottomNav = page.locator(".transport-bottom-nav");
    await bottomNav.getByRole("button", { name: /Транспорт/ }).click();
    await expect(page.locator(".transport-hub-panel")).toHaveClass(/is-open/);
    await bottomNav.getByRole("button", { name: /Карта/ }).click();
    await expect(page.locator(".transport-hub-panel")).toHaveClass(/is-closed/);
    await expect(bottomNav.getByRole("button", { name: /Карта/ })).toHaveClass(
      /is-active/,
    );
  }

  await page.getByTitle("Супутник").click();
  await expect(page.getByTitle("Супутник")).toHaveAttribute("aria-pressed", "true");
});

test("regional network exposes official-registry routes", async ({ page }) => {
  const response = await page.request.get("/transit-network.json");
  const network = await response.json();
  const regional = network.routes.filter((route: unknown[]) => route[5] === "registry");
  expect(regional).toHaveLength(14);
  expect(regional.some((route: unknown[]) => route[2] === "Ірпінь — Київ")).toBeTruthy();
  expect(regional.some((route: unknown[]) => route[2] === "Боярка — АС «Поділ»")).toBeTruthy();
});
