import { expect, test } from "@playwright/test";

// the shop page's title differs by layout, as in the Laravel app
const pages: [string, string | RegExp][] = [
  ["/", "Beranda - Inofarma"],
  ["/shop", /^(Belanja|Semua Produk) - Inofarma$/],
  ["/categories", "Kategori - Inofarma"],
  ["/apotek/jengki", "Apotek Inofarma Jengki - Inofarma"],
  ["/faq", "FAQ - Inofarma"],
  ["/pp", "Kebijakan Privasi - Inofarma"],
  ["/shipping-info", "Kebijakan Pengiriman - Inofarma"],
];

for (const [device, viewport] of [
  ["phone", { width: 390, height: 844 }],
  ["desktop", { width: 1440, height: 900 }],
] as const) {
  test(`storefront pages render on ${device} without errors`, async ({ page }) => {
    // the dev server compiles each page on its first visit
    test.setTimeout(180_000);
    await page.setViewportSize(viewport);
    const errors: string[] = [];

    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));

    for (const [path, title] of pages) {
      const response = await page.goto(path);

      expect(response?.status(), path).toBe(200);
      await expect(page).toHaveTitle(title);
    }

    expect(errors).toEqual([]);
  });
}

test("a missing or permanently closed apotek is a real 404", async ({ request }) => {
  expect((await request.get("/apotek/tidak-ada")).status()).toBe(404);
});

test("old /ui and /cabang-kami links redirect permanently", async ({ request }) => {
  const ui = await request.get("/ui/shop?q=vitamin", { maxRedirects: 0 });

  expect(ui.status()).toBe(301);
  expect(ui.headers().location).toMatch(/\/shop\?q=vitamin$/);
  expect((await request.get("/cabang-kami", { maxRedirects: 0 })).headers().location).toMatch(/\/$/);
});
