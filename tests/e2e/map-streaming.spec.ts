import { expect, test } from "@playwright/test";

test("streams local road and building tiles without runtime OSM requests", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/?e2e=1");
  await expect(page.getByTestId("loading-status")).toBeHidden({ timeout: 20_000 });
  await expect.poll(() => page.locator("body").getAttribute("data-loaded-map-tiles")).not.toBe("0");
  await expect.poll(async () => Number(await page.locator("body").getAttribute("data-loaded-buildings"))).toBeGreaterThan(0);
  await expect.poll(() => page.locator("body").getAttribute("data-loaded-building-layers")).toBe("building-roofs,building-walls,building-windows");
  const initialTiles = await page.locator("body").getAttribute("data-loaded-map-tiles");
  await page.evaluate(() => (window as any).__friedRaceTest.teleportToNeighborTile());
  const targetTile = await page.evaluate(() => (window as any).__friedRaceTest.targetMapTile());
  await expect.poll(() => page.locator("body").getAttribute("data-current-map-tile")).toBe(targetTile);
  await expect.poll(() => page.locator("body").getAttribute("data-loaded-map-tiles")).toContain(targetTile);
  await expect.poll(() => page.locator("body").getAttribute("data-loaded-building-layers")).toBe("building-roofs,building-walls,building-windows");
  const finalTiles = await page.locator("body").getAttribute("data-loaded-map-tiles");
  expect(finalTiles).not.toBe(initialTiles);
  expect((initialTiles ?? "").split(",").some((id) => (finalTiles ?? "").split(",").includes(id))).toBe(false);
  expect(requests.some((url) => url.includes(`/tile-${targetTile}.json`))).toBe(true);
  expect(requests.some((url) => /openstreetmap|overpass|osm\.org/i.test(url))).toBe(false);
  expect(requests.some((url) => url.includes("/map/manifest.json"))).toBe(true);
  expect(requests.some((url) => url.includes("/map/generations/"))).toBe(true);
});
