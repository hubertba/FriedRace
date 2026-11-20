import { expect, test } from "@playwright/test";

test("loads the Fried Race canvas and loading status", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Fried Race");
  await expect(page.locator("canvas[data-game-canvas]")).toHaveCount(1);
  await expect(page.getByTestId("loading-status")).toBeVisible();
});
