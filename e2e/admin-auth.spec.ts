import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { and, eq } from "drizzle-orm";
import { auditLogs, db, modelHasRoles, notifications, passwordResetTokens, roles, users } from "../src/db";
import { decryptString } from "../src/lib/laravel-crypt";
import { hashLaravelPassword } from "../src/lib/password";
import { totpAt } from "../src/lib/totp";

// A Super Admin made for this file signs in, sets up 2FA, signs in with it, and is
// thrown out by the session rules. Everything it creates is removed afterwards.
process.loadEnvFile(".env.local");

const stamp = Date.now();
const email = `zz-admin-e2e-${stamp}@example.com`;
let password = "Zz-Admin-E2e-1";
let staffId: number;

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1440, height: 900 } });
test.setTimeout(60_000);

test.beforeAll(async () => {
  const { redis } = await import("../src/lib/redis");

  for (const pattern of ["throttle:*", "limiter:*"]) {
    const keys = await redis.keys(pattern);

    if (keys.length) await redis.del(...keys);
  }

  redis.disconnect();

  const [staff] = await db
    .insert(users)
    .values({ name: "ZZ Admin E2E", email, password: await hashLaravelPassword(password), isActive: true, createdAt: new Date(), updatedAt: new Date() })
    .returning();
  const [superAdmin] = await db.select().from(roles).where(and(eq(roles.name, "Super Admin"), eq(roles.guardName, "web")));

  staffId = staff.id;
  await db.insert(modelHasRoles).values({ roleId: superAdmin.id, modelType: "App\\Models\\User", modelId: staff.id });
});

test.afterAll(async () => {
  await db.delete(notifications).where(eq(notifications.notifiableId, staffId));
  await db.delete(auditLogs).where(and(eq(auditLogs.auditableType, "App\\Models\\User"), eq(auditLogs.auditableId, staffId)));
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.email, email));
  await db.delete(modelHasRoles).where(and(eq(modelHasRoles.modelType, "App\\Models\\User"), eq(modelHasRoles.modelId, staffId)));
  await db.delete(users).where(eq(users.id, staffId));
  await db.$client.end();
});

async function signIn(page: Page, withPassword = password) {
  await page.goto("/admin/masuk");
  // wait for React to take over the form, or the click submits it as a plain page
  await page.waitForFunction(() => {
    const button = document.querySelector("form button[type=submit]");

    return button !== null && Object.keys(button).some((key) => key.startsWith("__reactFiber"));
  });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(withPassword);
  await page.getByRole("button", { name: "Masuk" }).click();
}

/**
 * The avatar menu. Straight after a full-page sign-in the (large, dev-mode) dashboard may
 * still be hydrating and miss a click, as a person would then click again; so does this.
 */
async function openUserMenu(page: Page) {
  await expect(async () => {
    await page.locator(".fi-user-menu-trigger").click();
    await expect(page.locator(".fi-dropdown-panel")).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 60_000 });
}

async function staffRow() {
  const [staff] = await db.select().from(users).where(eq(users.id, staffId));

  return staff;
}

test("signed out, every panel page leads to sign-in, and a wrong password is refused", async ({ page, request }) => {
  for (const path of ["/admin", "/admin/keamanan"]) {
    const response = await request.get(path, { maxRedirects: 0 });

    expect(response.status()).toBe(302);
    expect(response.headers().location).toMatch(/\/admin\/masuk$/);
  }

  expect((await request.get("/admin/dua-faktor", { maxRedirects: 0 })).headers().location).toMatch(/\/admin\/masuk$/);

  await signIn(page, "salah-sandi");
  await expect(page.getByText("Email atau kata sandi salah.")).toBeVisible();
});

test("signing in goes where the staff member was heading, with their sidebar, and is audited", async ({ page }) => {
  await page.goto("/admin/keamanan");
  await expect(page).toHaveURL(/\/admin\/masuk$/);
  await signIn(page);
  await expect(page).toHaveURL(/\/admin\/keamanan$/);
  await expect(page.locator(".fi-header-heading")).toHaveText("Keamanan");

  const labels = await page.locator(".fi-sidebar-nav .fi-sidebar-item-label").allTextContents();

  expect(labels.map((label) => label.trim())).toEqual([
    "Dasbor", "Pesanan", "Produk", "Pelanggan", "Inbox", "Kupon", "Newsletters", "Cabang", "Staf", "Peran", "Hak Akses", "Keamanan", "Media File", "Konten Website",
  ]);

  const staff = await staffRow();

  expect(staff.lastLoginAt).not.toBeNull();
  expect((await db.select().from(auditLogs).where(and(eq(auditLogs.action, "login"), eq(auditLogs.auditableId, staffId)))).length).toBe(1);

  // the sign-in page sends a signed-in staff member to the panel
  await page.goto("/admin/masuk");
  await expect(page).toHaveURL(/\/admin$/);
});

test("2FA: set up with a code, then signing in needs a code or a recovery code (once)", async ({ page }) => {
  test.setTimeout(120_000);

  await signIn(page);
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/keamanan");
  await page.locator(".fi-header-actions-ctn").getByRole("button", { name: "Aktifkan 2FA" }).click();
  await expect(page.getByText("Pindai kode QR dengan aplikasi authenticator Anda, lalu konfirmasi kodenya.")).toBeVisible();

  const codes = (await page.locator(".font-mono.text-sm span").allTextContents()).map((code) => code.trim());

  expect(codes).toHaveLength(8);
  codes.forEach((code) => expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/));

  // stored as Laravel stores it: encrypted with APP_KEY, not confirmed yet
  const pending = await staffRow();
  const secret = decryptString(pending.twoFactorSecret!);

  expect(secret).toMatch(/^[A-Z2-7]{32}$/);
  expect(JSON.parse(decryptString(pending.twoFactorRecoveryCodes!))).toEqual(codes);
  expect(pending.twoFactorConfirmedAt).toBeNull();
  await expect(page.locator(".fi-section")).toContainText(secret);

  await page.locator(".fi-header-actions-ctn").getByRole("button", { name: "Konfirmasi" }).click();
  await page.locator(".fi-modal-window input").fill("000000");
  await page.locator(".fi-modal-window").getByRole("button", { name: "Kirim" }).click();
  await expect(page.locator(".fi-fo-field-wrp-error-message")).toHaveText("Kode tidak valid.");
  await page.locator(".fi-modal-window input").fill(totpAt(secret, Math.floor(Date.now() / 30_000)));
  await page.locator(".fi-modal-window").getByRole("button", { name: "Kirim" }).click();
  await expect(page.getByText("Autentikasi dua faktor aktif.").first()).toBeVisible();
  expect((await staffRow()).twoFactorConfirmedAt).not.toBeNull();

  // sign out from the user menu, then back in: the password alone is not enough
  await openUserMenu(page);
  await page.getByRole("menuitem", { name: "Keluar" }).click();
  await expect(page).toHaveURL(/\/admin\/masuk$/);
  await signIn(page);
  await expect(page).toHaveURL(/\/admin\/dua-faktor$/);
  expect((await page.request.get("/admin", { maxRedirects: 0 })).status()).toBe(302);

  await page.locator("#code").fill("000000");
  await page.getByRole("button", { name: "Verifikasi" }).click();
  await expect(page.getByText("Kode tidak valid.")).toBeVisible();
  await page.locator("#code").fill(codes[0]);
  await page.getByRole("button", { name: "Verifikasi" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  expect(JSON.parse(decryptString((await staffRow()).twoFactorRecoveryCodes!))).toEqual(codes.slice(1));

  // the used recovery code is gone; an authenticator code still works
  await openUserMenu(page);
  await page.getByRole("menuitem", { name: "Keluar" }).click();
  await signIn(page);
  await page.locator("#code").fill(codes[0]);
  await page.getByRole("button", { name: "Verifikasi" }).click();
  await expect(page.getByText("Kode tidak valid.")).toBeVisible();
  await page.locator("#code").fill(totpAt(secret, Math.floor(Date.now() / 30_000)));
  await page.getByRole("button", { name: "Verifikasi" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  // turn it off again
  await page.goto("/admin/keamanan");
  await page.locator(".fi-header-actions-ctn").getByRole("button", { name: "Nonaktifkan 2FA" }).click();
  await page.locator(".fi-modal-window").getByRole("button", { name: "Konfirmasi" }).click();
  await expect(page.getByText("Autentikasi dua faktor dinonaktifkan.").first()).toBeVisible();
  expect((await staffRow()).twoFactorSecret).toBeNull();
});

test("the language switch, and the notification bell", async ({ page }) => {
  test.setTimeout(180_000);

  await db.insert(notifications).values([
    { id: crypto.randomUUID(), type: "App\\Notifications\\Admin\\LowStock", notifiableType: "App\\Models\\User", notifiableId: staffId, data: { format: "filament", title: "Stok menipis", body: "ZZ: tersisa 1 (batas 5)", actions: [] }, createdAt: new Date(Date.now() - 5 * 60_000), updatedAt: new Date() },
  ]);

  await signIn(page);
  await expect(page.locator(".fi-topbar-database-notifications-btn .fi-badge")).toHaveText("1");
  // clicked again if the freshly loaded dashboard wasn't listening yet
  await expect(async () => {
    await page.locator(".fi-topbar-database-notifications-btn").click();
    await expect(page.locator(".fi-no-notification-title")).toHaveText("Stok menipis", { timeout: 3000 });
  }).toPass({ timeout: 60_000 });
  await expect(page.locator(".fi-no-notification-date")).toHaveText("5 menit yang lalu");
  await page.getByRole("button", { name: "Tandai semua sudah dibaca" }).click();
  await expect(page.locator(".fi-no-notification-read-ctn")).toHaveCount(1);
  await page.getByRole("button", { name: "Bersihkan" }).click();
  await expect(page.locator(".fi-modal-heading")).toHaveText("Tidak ada notifikasi");
  expect(await db.select().from(notifications).where(eq(notifications.notifiableId, staffId))).toEqual([]);
  await page.keyboard.press("Escape");

  await openUserMenu(page);
  await page.locator('button[data-lang="en"]').click();
  // the dashboard is large in development; it takes a while to arrive in English
  await expect(page.locator(".fi-header-heading")).toHaveText("Dashboard", { timeout: 60_000 });
  await expect(page.locator(".fi-sidebar-item-label").nth(1)).toHaveText("Orders");
  await openUserMenu(page);
  await page.locator('button[data-lang="id"]').click();
  await expect(page.locator(".fi-header-heading")).toHaveText("Dasbor", { timeout: 60_000 });
});

test("a turned-off account and an idle session are signed out", async ({ page }) => {
  await signIn(page);
  await expect(page).toHaveURL(/\/admin$/);

  // 30 minutes without activity
  // its own connection: beforeAll closed the shared one
  const { default: Redis } = await import("ioredis");
  const redis = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379");
  const token = (await page.context().cookies()).find((cookie) => cookie.name === "inofarma_staff_session")!.value;
  const key = `session:staff:${createHash("sha256").update(token).digest("hex")}`;
  const data = JSON.parse((await redis.get(key))!);

  data.meta.lastActivityAt = Date.now() - 31 * 60_000;
  await redis.set(key, JSON.stringify(data), "EX", 3600);
  redis.disconnect();

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/masuk$/);
  expect((await page.request.get("/admin", { maxRedirects: 0 })).status()).toBe(302);

  // an account staff turned off can't sign in
  await db.update(users).set({ isActive: false }).where(eq(users.id, staffId));
  await signIn(page);
  await expect(page.getByText("Akun Anda telah dinonaktifkan.")).toBeVisible();
  await db.update(users).set({ isActive: true }).where(eq(users.id, staffId));
});

test("a password reset link sets a new password", async ({ page }) => {
  const token = "a".repeat(64);

  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.email, email));
  await db.insert(passwordResetTokens).values({ email, token: await hashLaravelPassword(token), createdAt: new Date() });

  await page.goto(`/admin/atur-ulang-sandi/${token}?email=${encodeURIComponent(email)}`);
  await expect(page.locator("#email")).toHaveValue(email);
  password = "Zz-Admin-Baru-2";
  await page.locator("#password").fill(password);
  await page.locator("#password_confirmation").fill(password);
  await page.getByRole("button", { name: "Ubah Kata Sandi" }).click();
  await expect(page).toHaveURL(/\/admin\/masuk$/);
  expect(await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.email, email))).toEqual([]);

  await signIn(page);
  await expect(page).toHaveURL(/\/admin$/);

  // an unknown address gets Laravel's (untranslated) broker message
  const unknown = await page.request.post("/admin/lupa-sandi", {
    data: { email: "zz-nobody@example.com" },
    headers: { Accept: "application/json", Origin: new URL(page.url()).origin },
  });

  expect((await unknown.json()).errors).toEqual({ email: ["We can't find a user with that email address."] });
});
