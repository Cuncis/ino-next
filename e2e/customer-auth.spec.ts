import { expect, test, type Page } from "@playwright/test";
import { eq, like } from "drizzle-orm";
import { customerAddresses, customers, db } from "../src/db";

// The flows write real rows into the development database; the accounts made here are removed afterwards.
process.loadEnvFile(".env.local");

const stamp = Date.now();
const email = `zz-e2e-${stamp}@example.com`;
const phone = `0899${String(stamp).slice(-8)}`;
const password = "rahasia-e2e-123";

/**
 * Opens a page and waits until React has taken over its form (React tags the elements it
 * controls), so what the test types reaches the form's state. The server-rendered HTML
 * arrives first, and the page's form becomes interactive a moment later.
 */
async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForFunction(() => {
    const target = [...document.querySelectorAll<HTMLElement>("form button[type=submit], main, body > div")].find((element) => element.offsetParent !== null);

    return target !== undefined && Object.keys(target).some((key) => key.startsWith("__reactFiber"));
  });
}

// Laravel's limits (e.g. 3 phone codes per 10 minutes) count per IP address; locally every
// request is the same client, so repeated test runs would use them up. Start from zero.
test.beforeAll(async () => {
  const { redis } = await import("../src/lib/redis");

  for (const pattern of ["throttle:*", "limiter:*"]) {
    const keys = await redis.keys(pattern);

    if (keys.length) await redis.del(...keys);
  }

  redis.disconnect();
});

test.afterAll(async () => {
  const created = await db.select({ id: customers.id }).from(customers).where(like(customers.email, "%zz-e2e-%@example.com"));

  for (const { id } of created) {
    await db.delete(customerAddresses).where(eq(customerAddresses.customerId, id));
    await db.delete(customers).where(eq(customers.id, id));
  }

  await db.$client.end();
});

// Next.js keeps the previous page mounted but hidden after a navigation, so the
// selectors below only match what is visible.

// the phone layout, as most shoppers see it
test.use({ viewport: { width: 390, height: 844 } });

test("a customer signs up, verifies their phone, signs out and back in, and deletes the account", async ({ page }) => {
  test.setTimeout(240_000);

  // sign up
  await open(page, "/signup");
  await page.locator('input[name="name"]:visible').fill("Tes E2E");
  await page.locator('input[name="phone"]:visible').fill(phone);
  await page.locator('input[name="email"]:visible').fill(email);
  await page.locator('input[name="password"]:visible').fill(password);
  await page.locator('input[name="password_confirmation"]:visible').fill(password);
  await page.locator('input[type="checkbox"]:visible').first().check();
  await page.locator('form button[type="submit"]:visible').click();
  await expect(page).toHaveURL(/\/verify-phone$/);

  // phone OTP: outside production the code is shown in the flash banner
  await page.locator('form button[type="submit"]:visible').click();
  await expect(page).toHaveURL(/\/otp-code$/);
  const banner = await page.getByText(/tanpa SMS gateway: \d{6}/).textContent();
  const code = /(\d{6})/.exec(banner ?? "")![1];

  for (const [index, digit] of [...code].entries()) {
    await page.locator('input[inputmode="numeric"]:visible').nth(index).fill(digit);
  }

  await page.locator('form button[type="submit"]:visible').click();
  await expect(page).toHaveURL(/\/account-created$/);

  // a protected page while signed in
  await open(page, "/profile");
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByText(email).first()).toBeVisible();

  // sign out, then the protected page sends us to sign in and back afterwards
  await page.getByText("Keluar").first().click();
  await expect(page).toHaveURL(/\/signin$/);
  await open(page, "/my-address");
  await expect(page).toHaveURL(/\/signin$/);

  await page.locator('input[name="email"]:visible').fill(email);
  await page.locator('input[name="password"]:visible').fill("salah-sekali");
  await page.locator('form button[type="submit"]:visible').click();
  await expect(page.getByText("Email/No. Telepon atau kata sandi salah.")).toBeVisible();

  // the phone number works as the sign-in name too
  await page.locator('input[name="email"]:visible').fill(phone);
  await page.locator('input[name="password"]:visible').fill(password);
  await page.locator('form button[type="submit"]:visible').click();
  await expect(page).toHaveURL(/\/my-address$/);

  // add an address
  await open(page, "/add-new-address");
  await expect(page.locator("select").first()).toBeVisible();
  const response = await page.request.post("/add-new-address", {
    headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest", Origin: new URL(page.url()).origin },
    data: { label: "Rumah", recipientName: "Tes E2E", phone, addressLine: "Jl. Tes No. 1", kota: "Jakarta Timur", provinsi: "DKI Jakarta" },
  });

  expect(await response.json()).toEqual({ redirect: "/my-address", flash: { success: "Alamat berhasil ditambahkan." } });
  await open(page, "/my-address");
  await expect(page.getByText("Jl. Tes No. 1").first()).toBeVisible();

  // delete the account (password confirmed)
  await open(page, "/privasi-saya");
  await page.locator('input[name="password"]:visible').fill(password);
  // "Hapus akun Anda? ..." is a browser confirm dialog
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator('form button[type="submit"]:visible').click();
  await expect(page).toHaveURL(/\/$/);
  // (the homepage shows no flash banner, as in the Laravel app)
  await open(page, "/profile");
  await expect(page).toHaveURL(/\/signin$/);

  // the account is gone: its email and password no longer sign in
  const signIn = await page.request.post("/signin", {
    headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest", Origin: new URL(page.url()).origin },
    data: { email, password },
  });

  expect(signIn.status()).toBe(422);
});

test("forms from another site are refused", async ({ request }) => {
  const response = await request.post("/signin", { headers: { Origin: "https://evil.example", Accept: "application/json" }, data: { email: "a", password: "b" } });

  expect(response.status()).toBe(419);
});
