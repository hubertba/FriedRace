import { expect, test } from "@playwright/test";

test("completes the MVP economy, garage, waypoint, persistence, and rally flow", async ({ page }) => {
  await page.goto("/?e2e=1");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByTestId("loading-status")).toBeHidden({ timeout: 20_000 });
  await expect(page.getByTestId("money")).toHaveText("€30,000");
  await expect(page.getByTestId("active-vehicle")).toContainText("Mitsubishi Eclipse 1995");

  await page.keyboard.down("w");
  await expect.poll(async () => Number((await page.getByTestId("speed").textContent())?.replace(/\D/g, ""))).toBeGreaterThan(0);
  await page.keyboard.up("w");

  await page.evaluate(() => (window as any).__friedRaceTest.startNearbyWaypoint());
  await page.evaluate(() => (window as any).__friedRaceTest.finishWaypoint());
  await expect.poll(() => page.evaluate(() => (window as any).__friedRaceTest.profile().money)).toBeGreaterThan(30_000);

  await page.evaluate(() => (window as any).__friedRaceTest.teleportToRallyStart());
  await expect(page.getByTestId("start-rally")).toBeDisabled();

  await page.evaluate(() => (window as any).__friedRaceTest.teleportToGarage());
  await page.evaluate(() => (window as any).__friedRaceTest.setMoney(100_000));
  await page.getByTestId("open-garage").click();
  const rallyCard = page.locator(".vehicle-list article").filter({ hasText: "Alpine Rally RS" });
  await rallyCard.getByRole("button", { name: "Kaufen" }).click();
  await rallyCard.getByRole("button", { name: "Auswählen" }).click();
  await expect(page.getByTestId("active-vehicle")).toContainText("Alpine Rally RS");

  await page.reload();
  await expect(page.getByTestId("loading-status")).toBeHidden({ timeout: 20_000 });
  await expect(page.getByTestId("active-vehicle")).toContainText("Alpine Rally RS");
  await page.evaluate(() => (window as any).__friedRaceTest.teleportToRallyStart());
  await expect(page.getByTestId("start-rally")).toBeEnabled();
  await page.getByTestId("start-rally").click();
  await page.evaluate(async () => (window as any).__friedRaceTest.completeRally());
  await expect(page.locator(".mystery-reveal")).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).__friedRaceTest.profile().completedEvents)).toContain("oberwart-gravel-sprint");
});
