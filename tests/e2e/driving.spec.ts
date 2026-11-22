import { expect, test } from "@playwright/test";

test("drives and resets the starter car", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("loading-status")).toBeHidden({ timeout: 40_000 });
  await expect(page.getByTestId("speed")).toHaveText("0 km/h");
  await expect(page.getByTestId("money")).toHaveText("€30,000");

  await page.keyboard.down("w");
  await expect.poll(async () => Number((await page.getByTestId("speed").textContent())?.replace(/\D/g, ""))).toBeGreaterThan(0);
  await page.keyboard.up("w");

  await page.keyboard.down("w");
  await page.waitForTimeout(400);
  await page.keyboard.up("w");
  await page.getByTestId("reset-car").click();
  await expect(page.locator("body")).toHaveAttribute("data-at-spawn", "true");
});
