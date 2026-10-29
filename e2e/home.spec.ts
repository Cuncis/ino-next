import { expect, test } from "@playwright/test";

test("home page renders with its title and the Indonesian locale", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Beranda - Inofarma");
  await expect(page.locator("html")).toHaveAttribute("lang", "id");
});
