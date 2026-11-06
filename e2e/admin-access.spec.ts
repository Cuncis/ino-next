import { expect, test, type Page } from "@playwright/test";
import { and, asc, eq, inArray, like } from "drizzle-orm";
import { auditLogs, branches, db, modelHasRoles, permissions, roleHasPermissions, roles, users } from "../src/db";
import { hashLaravelPassword } from "../src/lib/password";

process.loadEnvFile(".env.local");

/**
 * Step 7.6 of the admin: Cabang, Staf, Peran and Hak Akses, with Laravel's messages,
 * guards, audit entries and permissions. Its records carry ZZA<stamp> and are removed
 * afterwards; the role permissions are put back as they were.
 */
const stamp = Date.now() % 1_000_000;
const tag = `ZZA${stamp}`;
const lower = tag.toLowerCase();
const password = "Zz-Access-Spec-Pass-1";
const people = {
  admin: { email: `zz-acc-admin-${stamp}@example.com`, role: "Super Admin", branch: null as number | null },
  apj: { email: `zz-acc-apj-${stamp}@example.com`, role: "APJ Cabang", branch: 1 as number | null },
};
const staffIds: number[] = [];
let savedGrants: { roleId: number; permissionId: number }[] = [];

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1440, height: 900 } });
test.setTimeout(240_000);

test.beforeAll(async () => {
  const { redis } = await import("../src/lib/redis");

  for (const pattern of ["throttle:*", "limiter:*"]) {
    const keys = await redis.keys(pattern);

    if (keys.length) await redis.del(...keys);
  }

  redis.disconnect();

  const hash = await hashLaravelPassword(password);

  for (const person of Object.values(people)) {
    const [staff] = await db.insert(users).values({ name: `ZZ ${person.role}`, email: person.email, password: hash, branchId: person.branch, isActive: true, createdAt: new Date(), updatedAt: new Date() }).returning();
    const [role] = await db.select().from(roles).where(and(eq(roles.name, person.role), eq(roles.guardName, "web")));

    staffIds.push(staff.id);
    await db.insert(modelHasRoles).values({ roleId: role.id, modelType: "App\\Models\\User", modelId: staff.id });
  }

  savedGrants = await db.select().from(roleHasPermissions);
});

test.afterAll(async () => {
  await db.delete(branches).where(like(branches.name, `Apotek Inofarma ${tag}%`));
  await db.delete(roles).where(like(roles.name, `${tag}%`));

  const created = (await db.select({ id: users.id }).from(users).where(like(users.email, `${lower}-%`))).map((row) => row.id);
  const everyone = [...staffIds, ...created];

  await db.delete(roleHasPermissions);
  await db.insert(roleHasPermissions).values(savedGrants);
  await db.delete(auditLogs).where(inArray(auditLogs.userId, everyone));
  await db.delete(modelHasRoles).where(and(eq(modelHasRoles.modelType, "App\\Models\\User"), inArray(modelHasRoles.modelId, everyone)));
  await db.delete(users).where(inArray(users.id, everyone));
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

async function hydrated(page: Page) {
  await page.waitForFunction(() => Object.keys(document.querySelector("form, .fi-ta, table") ?? {}).some((key) => key.startsWith("__reactFiber")), undefined, { timeout: 60_000 });
}

const field = (page: Page, id: string) => page.locator(`[id="${id}"]`).filter({ visible: true }).first();
const toast = (page: Page, title: string) => expect(page.locator(".fi-no-notification-title").filter({ visible: true, hasText: title }).first()).toHaveText(title);
const fieldErrors = (page: Page) => page.locator(".fi-fo-field-wrp-error-message").filter({ visible: true });
const confirmIn = (page: Page, name: string) => page.locator(".fi-modal-open").getByRole("button", { name, exact: true }).click();

test("Cabang: created with its code, slug and hours, edited, and kept while it has stock or orders", async ({ page }) => {
  await signIn(page, people.admin.email);
  await page.goto("/admin/cabang/create");
  await hydrated(page);
  await field(page, "form.name").fill(`Apotek Inofarma ${tag} Uji`);
  await field(page, "form.phone").fill("abc");
  await field(page, "form.address_line").fill("Jl. Uji 1");
  await field(page, "form.kota").fill("Depok");
  await field(page, "form.provinsi").fill("Jawa Barat");
  await field(page, "form.latitude").fill("-6.4");
  await field(page, "form.longitude").fill("106.81");
  await page.getByRole("button", { name: "Buat", exact: true }).click();
  await expect(fieldErrors(page)).toHaveText(["Format kolom telepon tidak valid."]);
  await field(page, "form.phone").fill("021-555");
  await page.getByRole("button", { name: "Buat", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/cabang\/\d+\/edit$/);

  const [branch] = await db.select().from(branches).where(eq(branches.name, `Apotek Inofarma ${tag} Uji`));

  expect(branch.code).toMatch(/^CB-\d{3}$/);
  expect(branch).toMatchObject({ slug: `${lower}-uji`, latitude: "-6.4000000", longitude: "106.8100000", mapsUrl: "https://www.google.com/maps?q=-6.4,106.81", supportsDelivery: true, deliveryRadiusKm: 10, status: "aktif" });
  expect(branch.operatingHours).toMatchObject({ senin: { open: "08:00", close: "21:00" }, minggu: { open: "09:00", close: "20:00" } });

  // without delivery the coordinates may go; the map link goes with them
  await hydrated(page);
  await field(page, "form.supports_delivery").click();
  await expect(field(page, "form.latitude")).not.toHaveAttribute("required", "");
  await field(page, "form.latitude").fill("");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await toast(page, "Data berhasil disimpan");
  expect((await db.select().from(branches).where(eq(branches.id, branch.id)))[0]).toMatchObject({ latitude: null, mapsUrl: null, supportsDelivery: false });

  // a branch with stock or orders is closed, not deleted
  const refused = await page.request.post("/admin/cabang/2/hapus", { data: {}, headers: { Accept: "application/json", Origin: new URL(page.url()).origin } });

  expect((await refused.json()).toast).toMatchObject({ status: "danger", body: "Ubah statusnya menjadi Tutup Permanen." });

  await page.getByRole("button", { name: "Hapus", exact: true }).click();
  await confirmIn(page, "Hapus");
  await expect(page).toHaveURL(/\/admin\/cabang$/);
  expect((await db.select().from(branches).where(eq(branches.id, branch.id)))[0].deletedAt).not.toBeNull();
});

test("Staf: a new account with its branch and roles, edited without touching the password, and audited", async ({ page }) => {
  await signIn(page, people.admin.email);
  await page.goto("/admin/staf/create");
  await hydrated(page);
  await field(page, "form.name").fill(`${tag} Staf`);
  await field(page, "form.email").fill(people.apj.email);
  await field(page, "form.password").fill("pendek");
  await field(page, "form.password_confirmation").fill("berbeda");
  await page.getByRole("button", { name: "Buat", exact: true }).click();
  await expect(fieldErrors(page)).toHaveText(["Kolom email sudah digunakan.", "Kolom kata Sandi harus terdiri dari minimal 8 karakter."]);

  await field(page, "form.email").fill(`${lower}-staf@example.com`);
  await field(page, "form.password").fill("Rahasia-Uji-1");
  await field(page, "form.password_confirmation").fill("Rahasia-Uji-1");
  await page.getByLabel("Kasir", { exact: true }).filter({ visible: true }).check();
  await page.getByLabel("Staf Gudang", { exact: true }).filter({ visible: true }).check();
  await page.getByRole("button", { name: "Buat", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/staf\/\d+\/edit$/);

  const [account] = await db.select().from(users).where(eq(users.email, `${lower}-staf@example.com`));
  const roleNames = async () =>
    (await db.select({ name: roles.name }).from(modelHasRoles).innerJoin(roles, eq(roles.id, modelHasRoles.roleId)).where(and(eq(modelHasRoles.modelType, "App\\Models\\User"), eq(modelHasRoles.modelId, account.id))).orderBy(asc(roles.id))).map(
      (row) => row.name,
    );

  expect(account.password).toMatch(/^\$2y\$12\$/);
  expect(await roleNames()).toEqual(["Kasir", "Staf Gudang"]);

  await hydrated(page);
  await field(page, "form.phone").fill("0812");
  await page.getByLabel("Staf Gudang", { exact: true }).filter({ visible: true }).uncheck();
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await toast(page, "Data berhasil disimpan");

  const [saved] = await db.select().from(users).where(eq(users.id, account.id));

  expect(saved.password).toBe(account.password);
  expect(saved.phone).toBe("0812");
  expect(await roleNames()).toEqual(["Kasir"]);
  expect((await db.select().from(auditLogs).where(and(eq(auditLogs.auditableType, "App\\Models\\User"), eq(auditLogs.auditableId, account.id))).orderBy(asc(auditLogs.id))).map((entry) => [entry.action, entry.newValues])).toEqual([
    ["staff_created", { email: `${lower}-staf@example.com`, roles: ["Kasir", "Staf Gudang"] }],
    ["staff_updated", { email: `${lower}-staf@example.com`, roles: ["Kasir"] }],
  ]);

  // no one deletes their own account
  const self = await page.request.post(`/admin/staf/${staffIds[0]}/hapus`, { data: {}, headers: { Accept: "application/json", Origin: new URL(page.url()).origin } });

  expect((await self.json()).toast).toMatchObject({ status: "danger", title: "Anda tidak bisa menghapus akun Anda sendiri." });
});

test("Peran: created with permissions picked by search, and kept while staff hold it", async ({ page }) => {
  await signIn(page, people.admin.email);
  await page.goto("/admin/peran/create");
  await hydrated(page);
  await field(page, "form.name").fill("Kasir");
  await page.getByRole("button", { name: "Buat", exact: true }).click();
  await expect(fieldErrors(page)).toHaveText(["Kolom nama sudah digunakan."]);

  await field(page, "form.name").fill(`${tag} Peran`);
  await page.locator(".fi-fo-checkbox-list-search-input-wrp input").fill("Media");
  await expect(page.locator(".fi-fo-checkbox-list-option")).toHaveCount(3);
  await page.getByRole("button", { name: "Pilih semua" }).click();
  await expect(page.getByRole("button", { name: "Batalkan semua pilihan" })).toBeVisible();
  await page.getByRole("button", { name: "Buat", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/peran\/\d+\/edit$/);

  const [role] = await db.select().from(roles).where(eq(roles.name, `${tag} Peran`));
  const granted = await db.select({ name: permissions.name }).from(roleHasPermissions).innerJoin(permissions, eq(permissions.id, roleHasPermissions.permissionId)).where(eq(roleHasPermissions.roleId, role.id));

  expect(role.guardName).toBe("web");
  expect(granted.map((row) => row.name).sort()).toEqual(["Media:Hapus", "Media:Lihat", "Media:Unggah"]);

  const [kasir] = await db.select().from(roles).where(eq(roles.name, "Kasir"));
  const refused = await page.request.post(`/admin/peran/${kasir.id}/hapus`, { data: {}, headers: { Accept: "application/json", Origin: new URL(page.url()).origin } });

  expect((await refused.json()).toast.title).toMatch(/^Peran "Kasir" masih dipakai \d+ staf dan tidak bisa dihapus\.$/);

  await hydrated(page);
  await page.getByRole("button", { name: "Hapus", exact: true }).click();
  await confirmIn(page, "Hapus");
  await expect(page).toHaveURL(/\/admin\/peran$/);
  expect(await db.select().from(roles).where(eq(roles.id, role.id))).toEqual([]);
});

test("Hak Akses: saved for every role at once; APJ Cabang sees Cabang but not Staf, Peran or Hak Akses", async ({ page }) => {
  await signIn(page, people.admin.email);
  await page.goto("/admin/hak-akses");
  await hydrated(page);

  const box = page.getByLabel("Staf Gudang — Media Lihat", { exact: true });
  const before = await box.isChecked();

  await (before ? box.uncheck() : box.check());
  await page.getByRole("button", { name: "Simpan Perubahan" }).click();
  await toast(page, "Hak akses berhasil disimpan.");

  const [gudang] = await db.select().from(roles).where(eq(roles.name, "Staf Gudang"));
  const [mediaLihat] = await db.select().from(permissions).where(eq(permissions.name, "Media:Lihat"));

  expect((await db.select().from(roleHasPermissions).where(and(eq(roleHasPermissions.roleId, gudang.id), eq(roleHasPermissions.permissionId, mediaLihat.id)))).length).toBe(before ? 0 : 1);

  await signIn(page, people.apj.email);
  expect((await page.goto("/admin/cabang"))?.status()).toBe(200);

  for (const path of ["/admin/cabang/create", "/admin/staf", "/admin/peran", "/admin/hak-akses"]) {
    expect((await page.goto(path))?.status(), path).toBe(403);
  }
});
