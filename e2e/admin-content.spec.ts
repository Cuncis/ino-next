import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { and, eq, inArray, like } from "drizzle-orm";
import { auditLogs, db, modelHasRoles, permissions, roleHasPermissions, roles, settings, users } from "../src/db";
import { hashLaravelPassword } from "../src/lib/password";

process.loadEnvFile(".env.local");

/**
 * Step 7.7 of the admin: the Konten Website editors and Media File, with Laravel's
 * messages, saved JSON, audit entries and permissions. The content rows are put back as
 * they were, and the files uploaded here are removed.
 */
const stamp = Date.now() % 1_000_000;
const tag = `ZZK${stamp}`;
const password = "Zz-Content-Spec-Pass-1";
const people = {
  admin: { email: `zz-kon-admin-${stamp}@example.com`, role: "Super Admin" },
  viewer: { email: `zz-kon-viewer-${stamp}@example.com`, role: `${tag} Viewer` },
  apj: { email: `zz-kon-apj-${stamp}@example.com`, role: "APJ Cabang" },
};
const uploads = path.join(process.cwd(), "public", "storage");
const staffIds: number[] = [];
let savedContent: (typeof settings.$inferSelect)[] = [];
let mediaBefore: string[] = [];
let contentBefore: string[] = [];

const listDir = (directory: string) => readdir(directory).catch(() => [] as string[]);
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1440, height: 900 } });
test.setTimeout(300_000);

test.beforeAll(async () => {
  const { redis } = await import("../src/lib/redis");

  for (const pattern of ["throttle:*", "limiter:*"]) {
    const keys = await redis.keys(pattern);

    if (keys.length) await redis.del(...keys);
  }

  savedContent = await db.select().from(settings).where(like(settings.key, "content.%"));
  await db.delete(settings).where(like(settings.key, "content.%"));
  mediaBefore = await listDir(path.join(uploads, "media"));
  contentBefore = await listDir(path.join(uploads, "content"));

  // a role that may look at both pages and change nothing
  const [viewerRole] = await db.insert(roles).values({ name: people.viewer.role, guardName: "web", createdAt: new Date(), updatedAt: new Date() }).returning();
  const lookOnly = await db.select().from(permissions).where(and(eq(permissions.guardName, "web"), inArray(permissions.name, ["Konten:Lihat", "Media:Lihat"])));

  await db.insert(roleHasPermissions).values(lookOnly.map((permission) => ({ roleId: viewerRole.id, permissionId: permission.id })));

  const hash = await hashLaravelPassword(password);

  for (const person of Object.values(people)) {
    const [staff] = await db.insert(users).values({ name: `ZZ ${person.role}`, email: person.email, password: hash, branchId: person.role === "APJ Cabang" ? 1 : null, isActive: true, createdAt: new Date(), updatedAt: new Date() }).returning();
    const [role] = await db.select().from(roles).where(and(eq(roles.name, person.role), eq(roles.guardName, "web")));

    staffIds.push(staff.id);
    await db.insert(modelHasRoles).values({ roleId: role.id, modelType: "App\\Models\\User", modelId: staff.id });
  }
});

test.afterAll(async () => {
  await db.delete(settings).where(like(settings.key, "content.%"));

  if (savedContent.length) {
    await db.insert(settings).values(savedContent);
  }

  for (const [folder, before] of [
    ["media", mediaBefore],
    ["content", contentBefore],
  ] as const) {
    for (const file of await listDir(path.join(uploads, folder))) {
      if (!before.includes(file)) await rm(path.join(uploads, folder, file));
    }
  }

  const { redis } = await import("../src/lib/redis");

  await redis.del("media-library.items.v2");
  redis.disconnect();

  await db.delete(auditLogs).where(inArray(auditLogs.userId, staffIds));
  await db.delete(modelHasRoles).where(and(eq(modelHasRoles.modelType, "App\\Models\\User"), inArray(modelHasRoles.modelId, staffIds)));
  await db.delete(users).where(inArray(users.id, staffIds));
  await db.delete(roles).where(like(roles.name, `${tag}%`));
  await db.$client.end();
});

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/admin/masuk");
  await page.waitForFunction(() => Object.keys(document.querySelector("form") ?? {}).some((key) => key.startsWith("__reactFiber")));
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 60_000 });
}

async function hydrated(page: Page, selector = "form") {
  await page.waitForFunction((target) => Object.keys(document.querySelector(target) ?? {}).some((key) => key.startsWith("__reactFiber")), selector, { timeout: 60_000 });
}

async function savedJson(key: string): Promise<unknown> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key));

  return row ? JSON.parse(row.value ?? "null") : null;
}

const toast = (page: Page, title: string) => expect(page.locator(".fi-no-notification-title", { hasText: title })).toBeVisible({ timeout: 60_000 });

test("pages are refused without the right permission, and read-only without Konten:Ubah", async ({ page }) => {
  await signIn(page, people.apj.email);

  for (const url of ["/admin/konten-website", "/admin/konten-website/faq", "/admin/media-file"]) {
    expect((await page.goto(url))?.status(), url).toBe(403);
  }

  expect((await page.request.post("/admin/konten-website/faq/simpan", { data: { state: {} }, headers: { Accept: "application/json", Origin: new URL(page.url()).origin } })).status()).toBe(403);

  await signIn(page, people.viewer.email);
  await page.goto("/admin/konten-website");
  await expect(page.locator(".fi-sidebar-item-label", { hasText: "Konten Website" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ubah Konten" })).toHaveCount(7);

  await page.goto("/admin/konten-website/faq");
  await expect(page.getByRole("heading", { name: "Konten FAQ" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Simpan" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Tambah pertanyaan" })).toHaveCount(0);
  expect((await page.request.post("/admin/konten-website/faq/simpan", { data: { state: {} }, headers: { Accept: "application/json", Origin: new URL(page.url()).origin } })).status()).toBe(403);

  await page.goto("/admin/media-file");
  await hydrated(page, "section");
  await expect(page.getByRole("button", { name: "Upload File" })).toHaveCount(0);
  expect((await page.request.post("/admin/media-file/hapus", { data: { path: "media/x.png" }, headers: { Accept: "application/json", Origin: new URL(page.url()).origin } })).status()).toBe(403);
});

test("FAQ: the browser's own check, then edit, add and delete saved as Laravel writes them", async ({ page }) => {
  await signIn(page, people.admin.email);
  await page.goto("/admin/konten-website/faq");
  await hydrated(page);

  const items = page.locator("li.fi-fo-repeater-item");

  await page.getByText("Tampilkan semua", { exact: true }).click();
  await items.nth(0).locator('input[type="text"]').fill(`  ${tag} "satu" & <b>x</b>  `);
  await items.nth(0).locator("textarea").fill("Satu.\n\n\nDua baris.");
  await page.getByRole("button", { name: "Tambah pertanyaan" }).click();
  // a new item opens expanded
  await items.last().locator('input[type="text"]').fill(`${tag} baru`);
  await items.last().locator("textarea").fill("Jawaban baru");
  await items.nth(1).getByRole("button", { name: "Hapus" }).click();
  await page.getByRole("button", { name: "Simpan" }).click();
  await toast(page, "Konten FAQ disimpan.");

  const saved = (await savedJson("content.faq")) as { items: { question: string; answer: string }[] };

  expect(saved.items[0]).toEqual({ question: `${tag} "satu" & <b>x</b>`, answer: "Satu.\n\n\nDua baris." });
  expect(saved.items.at(-1)).toEqual({ question: `${tag} baru`, answer: "Jawaban baru" });
  expect(saved.items).toHaveLength(5);

  const [row] = await db.select().from(settings).where(eq(settings.key, "content.faq"));

  // json_encode(): unescaped slashes and unicode, but U+2028 escaped
  expect(row.value).toContain("Dua\\u2028baris.");
  expect(row.type).toBe("json");

  const [audit] = await db.select().from(auditLogs).where(and(inArray(auditLogs.userId, staffIds), eq(auditLogs.action, "konten_diubah")));

  expect(audit.newValues).toEqual({ halaman: "konten-website/faq" });
});

test("Footer: a bad link is refused with Laravel's message, then saved", async ({ page }) => {
  await signIn(page, people.admin.email);
  await page.goto("/admin/konten-website/footer");
  await hydrated(page);
  await page.getByLabel("Judul kolom tentang").fill(`${tag} Tentang`);
  await page.getByRole("button", { name: "Tambah tautan" }).click();

  const link = page.locator("li.fi-fo-repeater-item").last();

  await link.getByLabel("Teks").fill(`${tag} Link`);
  await link.getByLabel("Tautan").fill("ftp://contoh");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.locator(".fi-fo-field-wrp-error-message")).toHaveText(["Format kolom tautan tidak valid."]);
  expect(await savedJson("content.footer")).toBeNull();

  await link.getByLabel("Tautan").fill("/shop?kategori=1");
  await page.getByRole("button", { name: "Simpan" }).click();
  await toast(page, "Konten Footer & Perusahaan disimpan.");

  const saved = (await savedJson("content.footer")) as { aboutTitle: string; links: { label: string; href: string }[] };

  expect(saved.aboutTitle).toBe(`${tag} Tentang`);
  expect(saved.links.at(-1)).toEqual({ label: `${tag} Link`, href: "/shop?kategori=1" });
});

test("Beranda: the tab follows the URL both ways, and an uploaded slide is saved by its public URL", async ({ page }) => {
  await signIn(page, people.admin.email);
  await page.goto("/admin/konten-website/beranda?bagian=judul-bagian::data::tab");
  await hydrated(page);
  await expect(page.getByRole("tab", { name: "Judul Bagian" })).toHaveAttribute("aria-selected", "true");
  await page.locator('[role="tabpanel"].fi-active input[type="text"]').first().fill(`${tag} Rekomendasi`);

  await page.getByRole("tab", { name: "Banner Promo" }).click();
  await expect(page).toHaveURL(/bagian=banner-promo%3A%3Adata%3A%3Atab/);
  await page.getByRole("button", { name: "Tambah slide" }).click();

  const slide = page.locator('[role="tabpanel"].fi-active li.fi-fo-repeater-item').last();

  await slide.locator('input[type="file"]').setInputFiles({ name: "promo.png", mimeType: "image/png", buffer: png });
  await expect(slide.locator('.filepond--item[data-filepond-item-state="processing-complete"]')).toBeVisible({ timeout: 60_000 });
  await slide.getByLabel("Tautan").fill("/shop");
  await slide.getByLabel("Teks alternatif").fill(`${tag} Promo`);
  await page.getByRole("button", { name: "Simpan" }).click();
  await toast(page, "Konten Beranda disimpan.");
  // the URL keeps the tab after the page refreshes
  await expect(page).toHaveURL(/bagian=banner-promo%3A%3Adata%3A%3Atab/);

  const saved = (await savedJson("content.home")) as Record<string, unknown> & { headings: Record<string, string>; promo: { image: string; href: string; alt: string }[] };

  expect(Object.keys(saved)).toEqual(["hero", "allProductsIcon", "promo", "bottom", "brands", "benefits", "testimonials", "headings", "texts", "contactTitle", "contactIntro", "contacts"]);
  expect(saved.headings.recommended).toBe(`${tag} Rekomendasi`);
  expect(saved.promo.at(-1)).toEqual({ image: expect.stringMatching(/^https?:\/\/[^/]+\/storage\/content\/[A-Za-z0-9]{40}\.png$/), href: "/shop", alt: `${tag} Promo` });
});

test("Media File: upload from the header and by dropping, search, details and delete", async ({ page }) => {
  await signIn(page, people.admin.email);
  await page.goto("/admin/media-file");
  await hydrated(page, "section");
  page.on("dialog", (dialog) => void dialog.accept());

  await page.getByRole("button", { name: "Upload File" }).click();

  const modal = page.locator(".fi-modal-window:visible");

  await modal.getByRole("button", { name: "Kirim" }).click();
  await expect(modal.locator(".fi-fo-field-wrp-error-message")).toHaveText(["Kolom file wajib diisi."]);
  await modal.locator('input[type="file"]').setInputFiles({ name: `Banner ${tag}.PNG`, mimeType: "image/png", buffer: png });
  await expect(modal.locator('.filepond--item[data-filepond-item-state="processing-complete"]')).toBeVisible({ timeout: 60_000 });
  await modal.getByRole("button", { name: "Kirim" }).click();
  await toast(page, "1 file diunggah.");

  const drop = (files: { name: string; type: string; data: string }[]) =>
    page.evaluate((files) => {
      const transfer = new DataTransfer();

      for (const file of files) transfer.items.add(new File([Uint8Array.from(atob(file.data), (c) => c.charCodeAt(0))], file.name, { type: file.type }));

      window.dispatchEvent(new DragEvent("dragenter", { dataTransfer: transfer, bubbles: true }));
      window.dispatchEvent(new DragEvent("drop", { dataTransfer: transfer, bubbles: true, cancelable: true }));
    }, files);

  // a text file is refused, even one named and declared as a PNG: the type comes from its bytes
  for (const fake of [
    { name: "catatan.txt", type: "text/plain", data: Buffer.from("halo").toString("base64") },
    { name: "palsu.png", type: "image/png", data: Buffer.from("halo").toString("base64") },
  ]) {
    await drop([fake]);
    await expect(page.locator(".fi-no-notification-body", { hasText: "Hanya gambar (JPG, PNG, GIF, WebP, SVG, AVIF) dan PDF yang bisa diunggah." })).toBeVisible({ timeout: 60_000 });
    await page.locator(".fi-no-notification-close-btn").first().click();
    // a drop while an upload is still going is ignored, as Laravel's upload() does
    await expect(page.locator(".fi-no-notification")).toHaveCount(0, { timeout: 30_000 });
  }

  await drop([{ name: `drop ${tag}.png`, type: "image/png", data: png.toString("base64") }]);
  await toast(page, "1 file diunggah.");

  const lower = tag.toLowerCase();
  const stored = (await listDir(path.join(uploads, "media"))).filter((file) => file.includes(lower));

  expect(stored.sort()).toEqual([expect.stringMatching(new RegExp(`^banner-${lower}-[a-z0-9]{5}\\.png$`)), expect.stringMatching(new RegExp(`^drop-${lower}-[a-z0-9]{5}\\.png$`))]);

  await page.getByPlaceholder("Cari nama file…").fill(lower);
  await page.getByRole("button", { name: "Daftar", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`\\?cari=${lower}&tampilan=daftar$`));
  await expect(page.locator("section table tbody tr")).toHaveCount(2);
  await expect(page.getByText("2 file", { exact: true })).toBeVisible();

  await page.locator("section table tbody tr").first().click();
  await expect(page.locator("aside dl")).toContainText("Unggahan");
  await page.locator("aside").getByRole("button", { name: "Hapus permanen" }).click();
  await toast(page, "File dihapus.");
  await expect(page.locator("section table tbody tr")).toHaveCount(1);
  expect((await listDir(path.join(uploads, "media"))).filter((file) => file.includes(lower))).toHaveLength(1);

  // only files uploaded here can go
  const refused = await page.request.post("/admin/media-file/hapus", { data: { path: "products/1/x.jpg" }, headers: { Accept: "application/json", Origin: new URL(page.url()).origin } });

  expect(await refused.json()).toEqual({});
});
