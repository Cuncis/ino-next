import { expect, test } from "@playwright/test";

test("home page renders with the Inofarma title and Indonesian locale", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Inofarma");
  await expect(page.locator("html")).toHaveAttribute("lang", "id");
});
