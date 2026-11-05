import { expect, test, type Page } from "@playwright/test";
import { and, eq, inArray, isNull, like, sql } from "drizzle-orm";
import { chatConversations, chatMessages, couponBranch, coupons, customerAddresses, customers, db, modelHasRoles, newsletters, roles, settings, subscribers, users } from "../src/db";
import { hashLaravelPassword } from "../src/lib/password";

process.loadEnvFile(".env.local");

/**
 * Step 7.5 of the admin: Pelanggan, Kupon, Subscriber, the Inbox (with Pengaturan Chat)
 * and Newsletter, with Laravel's messages and permissions. Its records carry ZZC<stamp>
 * and are removed afterwards; the chat settings are put back as they were.
 */
const stamp = Date.now() % 1_000_000;
const tag = `ZZC${stamp}`;
const lower = tag.toLowerCase();
const password = "Zz-Crm-Spec-Pass-1";
const people = {
  admin: { email: `zz-crm-admin-${stamp}@example.com`, role: "Super Admin", branch: null as number | null },
  kasir: { email: `zz-crm-kasir-${stamp}@example.com`, role: "Kasir", branch: 1 as number | null },
};
const staffIds: number[] = [];
let conversationId: number;
let savedSettings: (typeof settings.$inferSelect)[] = [];

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

  const now = new Date();
  const [conversation] = await db
    .insert(chatConversations)
    .values({ token: `${lower}`.padEnd(40, "t"), name: `${tag} Pengunjung`, email: `${lower}-visit@example.com`, status: "terbuka", adminUnreadCount: 1, lastMessageAt: now, createdAt: now, updatedAt: now })
    .returning();

  conversationId = conversation.id;
  await db.insert(chatMessages).values({ chatConversationId: conversationId, sender: "pengunjung", body: "Apakah ada vitamin C?", createdAt: now, updatedAt: now });
  savedSettings = await db.select().from(settings).where(and(isNull(settings.branchId), like(settings.key, "chat.%")));
});

test.afterAll(async () => {
  // the reply's email waits in the queue for the visitor; it isn't wanted from a test
  const { Queue } = await import("bullmq");
  const { closeQueue, QUEUE_NAME, queueConnection } = await import("../src/lib/queue");
  const queue = new Queue(QUEUE_NAME, { connection: queueConnection() });

  for (const job of await queue.getJobs(["delayed", "waiting"])) {
    if (job.name === "chat-replied" && String(job.data.email).startsWith(lower)) {
      await job.remove();
    }
  }

  await queue.close();
  await closeQueue();

  await db.delete(customers).where(like(customers.email, `${lower}-%`));
  await db.delete(coupons).where(like(coupons.code, `${tag}%`));
  await db.delete(subscribers).where(like(subscribers.email, `${lower}-%`));
  await db.delete(chatConversations).where(eq(chatConversations.id, conversationId));
  await db.delete(newsletters).where(like(newsletters.name, `${tag}%`));
  await db.delete(settings).where(and(isNull(settings.branchId), like(settings.key, "chat.%")));

  if (savedSettings.length) {
    await db.insert(settings).values(savedSettings);
  }

  await db.delete(modelHasRoles).where(and(eq(modelHasRoles.modelType, "App\\Models\\User"), inArray(modelHasRoles.modelId, staffIds)));
  await db.delete(users).where(inArray(users.id, staffIds));
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

/** Waits until the page's React has hydrated, so a click reaches its handler. */
async function hydrated(page: Page) {
  await page.waitForFunction(() => Object.keys(document.querySelector("form, .fi-ta") ?? {}).some((key) => key.startsWith("__reactFiber")), undefined, { timeout: 60_000 });
}

const field = (page: Page, id: string) => page.locator(`[id="${id}"]`).filter({ visible: true }).first();
/** A notification with this title is showing (earlier ones may still be on screen). */
const toast = (page: Page, title: string) => expect(page.locator(".fi-no-notification-title").filter({ visible: true, hasText: title }).first()).toHaveText(title);
const fieldErrors = (page: Page) => page.locator(".fi-fo-field-wrp-error-message").filter({ visible: true });

test("Pelanggan: created with its default address, edited, and kept when it has orders", async ({ page }) => {
  await signIn(page, people.admin.email);
  await page.goto("/admin/pelanggan/create");
  await hydrated(page);
  await field(page, "form.name").fill(`${tag} Pelanggan`);
  await field(page, "form.email").fill(`${lower}-cust@example.com`);
  await field(page, "form.phone").fill("abc");
  await field(page, "form.city").fill("Jakarta Barat");
  await field(page, "form.address").fill("Jl. Uji 1");
  await page.getByRole("button", { name: "Buat", exact: true }).click();
  await expect(fieldErrors(page)).toHaveText(["Nomor telepon hanya boleh berisi angka, spasi, dan tanda + - ( )."]);

  await field(page, "form.phone").fill("0812-1111-2222");
  await page.getByRole("button", { name: "Buat", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/pelanggan\/\d+\/edit$/);
  await toast(page, "Data berhasil dibuat");

  const [customer] = await db.select().from(customers).where(eq(customers.email, `${lower}-cust@example.com`));

  expect(customer).toMatchObject({ name: `${tag} Pelanggan`, phone: "0812-1111-2222", status: "aktif" });
  expect(customer.code).toMatch(/^CUS-\d{3}$/);
  expect(customer.password).toMatch(/^\$2y\$/);
  expect((await db.select().from(customerAddresses).where(eq(customerAddresses.customerId, customer.id))).map((address) => [address.label, address.addressLine, address.kota, address.provinsi, address.isDefault])).toEqual([
    ["Rumah", "Jl. Uji 1", "Jakarta Barat", "DKI Jakarta", true],
  ]);

  // the city and address live on the default address; an emptied address is stored as a dash
  await hydrated(page);
  await field(page, "form.city").fill("Depok");
  await field(page, "form.address").fill("");
  await field(page, "form.status").selectOption("nonaktif");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await toast(page, "Data berhasil disimpan");
  expect((await db.select().from(customerAddresses).where(eq(customerAddresses.customerId, customer.id))).map((address) => [address.addressLine, address.kota])).toEqual([["—", "Depok"]]);

  // the same email again is refused
  await page.goto("/admin/pelanggan/create");
  await hydrated(page);
  await field(page, "form.name").fill(`${tag} Dua`);
  await field(page, "form.email").fill(`${lower}-cust@example.com`);
  await field(page, "form.phone").fill("0812");
  await field(page, "form.city").fill("Bogor");
  await page.getByRole("button", { name: "Buat", exact: true }).click();
  await expect(fieldErrors(page)).toHaveText(["Email ini sudah dipakai pelanggan lain."]);

  // a customer with orders isn't deleted
  const [withOrders] = (
    await db.execute<{ id: number; name: string; total: number }>(
      sql`select c.id, c.name, count(o.id)::int as total from customers c join orders o on o.customer_id = c.id and o.deleted_at is null where c.deleted_at is null group by c.id order by c.id limit 1`,
    )
  ).rows;
  const refused = await page.request.post(`/admin/pelanggan/${withOrders.id}/hapus`, { data: {}, headers: { Accept: "application/json", Origin: new URL(page.url()).origin } });

  expect((await refused.json()).toast).toMatchObject({ status: "danger", title: `"${withOrders.name}" memiliki ${withOrders.total} pesanan dan tidak bisa dihapus.`, body: "Ubah statusnya menjadi Nonaktif." });

  // a Kasir may list and create customers, not edit or delete them
  await signIn(page, people.kasir.email);
  expect((await page.goto("/admin/pelanggan"))?.status()).toBe(200);
  expect((await page.goto(`/admin/pelanggan/${withOrders.id}/edit`))?.status()).toBe(403);
  expect((await page.goto("/admin/kupon"))?.status()).toBe(403);
});

test("Kupon: an upper-cased code, free shipping without a value, and its branches", async ({ page }) => {
  await signIn(page, people.admin.email);
  await page.goto("/admin/kupon/create");
  await hydrated(page);
  await field(page, "form.code").fill(`${lower}hemat`);
  await field(page, "form.code").blur();
  await expect(field(page, "form.code")).toHaveValue(`${tag}HEMAT`);
  await field(page, "form.type").selectOption("ongkir gratis");
  await expect(page.locator('[id="form.value"]').filter({ visible: true })).toHaveCount(0);
  await field(page, "form.minimum_purchase").fill("100000");
  await field(page, "form.starts_at").fill("2026-11-10");
  await field(page, "form.expires_at").fill("2026-11-01");

  for (const name of ["Apotek Inofarma Otista", "Apotek Inofarma Kalisari"]) {
    await page.getByLabel(name, { exact: true }).filter({ visible: true }).check();
  }

  await page.getByRole("button", { name: "Buat", exact: true }).click();
  await expect(fieldErrors(page)).toHaveText(["Tanggal berlaku sampai tidak boleh sebelum tanggal mulai."]);
  await field(page, "form.expires_at").fill("2026-12-31");
  await page.getByRole("button", { name: "Buat", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/kupon\/\d+\/edit$/);

  const [coupon] = await db.select().from(coupons).where(eq(coupons.code, `${tag}HEMAT`));

  expect(coupon).toMatchObject({ type: "ongkir gratis", value: 0, minimumPurchase: 100000, quota: null, status: "aktif" });
  expect((await db.select({ branchId: couponBranch.branchId }).from(couponBranch).where(eq(couponBranch.couponId, coupon.id))).map((row) => row.branchId).sort((a, b) => a - b)).toEqual([2, 13]);

  // the value comes back for a fixed discount, labelled in rupiah
  await hydrated(page);
  await field(page, "form.type").selectOption("nominal");
  await expect(page.locator('label[for="form.value"]').filter({ visible: true })).toContainText("Nilai Diskon (Rp)");
  await field(page, "form.value").fill("15000");
  await page.getByLabel("Apotek Inofarma Otista", { exact: true }).filter({ visible: true }).uncheck();
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await toast(page, "Data berhasil disimpan");
  expect((await db.select({ branchId: couponBranch.branchId }).from(couponBranch).where(eq(couponBranch.couponId, coupon.id))).map((row) => row.branchId)).toEqual([13]);

  await page.goto(`/admin/kupon?search=${tag}`);

  const row = page.locator("tbody tr").filter({ visible: true }).first();

  for (const text of ["Nominal", "Rp15.000", "Rp100.000", "Apotek Inofarma Kalisari", "31 Des 2026", "Aktif"]) {
    await expect(row).toContainText(text);
  }
});

test("Subscriber: imported from CSV without re-subscribing anyone, exported, and stopped", async ({ page }) => {
  await signIn(page, people.admin.email);
  await page.goto("/admin/subscriber");
  await hydrated(page);
  await page.getByRole("button", { name: "Import CSV" }).click();

  const modal = page.locator(".fi-modal-open .fi-modal-window");

  await modal.locator("input[type=file]").setInputFiles({
    name: "subscriber.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(`\uFEFFEmail;Status\n${lower}-a@example.com;berlangganan\n ${tag}-B@Example.com ;Berhenti\nnot-an-email;\n\n${lower}-a@example.com;\n`),
  });
  await expect(modal.locator(".filepond--file")).toHaveCount(1);
  await modal.getByRole("button", { name: "Kirim", exact: true }).click();
  await toast(page, "Import selesai");
  await expect(page.locator(".fi-no-notification-body").filter({ visible: true })).toHaveText("2 ditambahkan, 1 sudah ada, 1 tidak valid.");
  expect((await db.select({ email: subscribers.email, status: subscribers.status }).from(subscribers).where(like(subscribers.email, `${lower}-%`)).orderBy(subscribers.email)).map((row) => [row.email, row.status])).toEqual([
    [`${lower}-a@example.com`, "berlangganan"],
    [`${lower}-b@example.com`, "berhenti"],
  ]);

  const exported = await page.request.get(`/form/admin/subscriber/ekspor?search=${lower}&filter_status=berhenti`);

  expect((await exported.text()).split("\n").slice(0, 2)).toEqual(["email,status,subscribed_at,unsubscribed_at", expect.stringMatching(new RegExp(`^${lower}-b@example.com,berhenti,,"\\d{4}-\\d\\d-\\d\\d \\d\\d:\\d\\d:\\d\\d"$`))]);

  await page.goto(`/admin/subscriber?search=${lower}-a`);
  await hydrated(page);
  await page.getByRole("button", { name: "Berhentikan" }).filter({ visible: true }).click();
  await expect(page.locator(".fi-modal-open .fi-modal-description")).toHaveText(`${lower}-a@example.com tidak akan menerima newsletter lagi.`);
  await page.locator(".fi-modal-open").getByRole("button", { name: "Konfirmasi" }).click();
  await toast(page, "Langganan dihentikan.");
  expect((await db.select().from(subscribers).where(eq(subscribers.email, `${lower}-a@example.com`)))[0].status).toBe("berhenti");
});

test("Inbox: read on opening, answered, closed and reopened, and Pengaturan Chat", async ({ page }) => {
  await signIn(page, people.admin.email);
  await page.goto(`/admin/inbox?search=${tag}`);
  await expect(page.locator(".fi-sidebar-item-badge-ctn .fi-badge-label")).toBeVisible();
  await expect(page.locator("tbody tr").filter({ visible: true }).first()).toContainText("Apakah ada vitamin C?");

  await page.goto(`/admin/inbox/${conversationId}`);
  await hydrated(page);
  expect((await db.select().from(chatConversations).where(eq(chatConversations.id, conversationId)))[0].adminUnreadCount).toBe(0);
  await page.getByRole("button", { name: "Kirim Balasan" }).click();
  await expect(page.locator("p.text-danger-600")).toHaveText("Kolom Balasan wajib diisi.");
  await page.getByPlaceholder("Tulis balasan").fill("Ada, Kak.");
  await page.getByRole("button", { name: "Kirim Balasan" }).click();
  await toast(page, "Balasan terkirim");
  expect((await db.select().from(chatMessages).where(and(eq(chatMessages.chatConversationId, conversationId), eq(chatMessages.sender, "admin")))).map((message) => [message.body, message.userId])).toEqual([
    ["Ada, Kak.", staffIds[0]],
  ]);

  await page.getByRole("button", { name: "Tutup Percakapan" }).click();
  await page.locator(".fi-modal-open").getByRole("button", { name: "Konfirmasi" }).click();
  await expect(page.getByRole("button", { name: "Buka Kembali" })).toBeVisible();
  expect((await db.select().from(chatConversations).where(eq(chatConversations.id, conversationId)))[0].status).toBe("ditutup");
  await page.getByRole("button", { name: "Buka Kembali" }).click();
  await expect(page.getByRole("button", { name: "Tutup Percakapan" })).toBeVisible();

  await page.goto("/admin/inbox");
  await hydrated(page);
  await page.getByRole("button", { name: "Pengaturan Chat" }).click();

  const modal = page.locator(".fi-modal-open .fi-modal-window");

  await modal.locator('[id="mountedActionSchema0.welcome_message"]').fill(`Halo dari ${tag}`);
  await modal.getByRole("button", { name: "Tambah pertanyaan" }).click();

  const item = modal.locator(".fi-fo-repeater-item").last();

  await item.locator('input[id$=".question"]').fill("Promo?");
  await item.locator('input[id$=".url"]').fill("ftp://contoh");
  await modal.getByRole("button", { name: "Kirim", exact: true }).click();
  await expect(modal.locator(".fi-fo-field-wrp-error-message")).toHaveText(["Tautan harus diawali / atau https://."]);
  await item.locator('input[id$=".url"]').fill("/shop");
  await modal.getByRole("button", { name: "Kirim", exact: true }).click();
  await toast(page, "Pengaturan chat disimpan.");

  const saved = Object.fromEntries((await db.select().from(settings).where(and(isNull(settings.branchId), like(settings.key, "chat.%")))).map((row) => [row.key, row.value]));

  expect(saved["chat.welcome_message"]).toBe(`Halo dari ${tag}`);
  expect(JSON.parse(saved["chat.quick_questions"] ?? "[]").at(-1)).toEqual({ question: "Promo?", url: "/shop", type: "message", answer: null, phone: null });
});

test("Newsletter: written in the editor, stored as tiptap-php wrote it, previewed and test-mailed", async ({ page }) => {
  await signIn(page, people.admin.email);
  await page.goto("/admin/newsletter/create");
  await hydrated(page);
  await field(page, "form.name").fill(`${tag} Kosong`);
  await field(page, "form.subject").fill("Kosong");
  await page.getByRole("button", { name: "Buat", exact: true }).click();
  await expect(fieldErrors(page)).toHaveText(["Kolom content wajib diisi."]);

  await field(page, "form.name").fill(`${tag} Newsletter`);
  await field(page, "form.subject").fill("Promo");

  const tool = (name: string) => page.locator(`[data-rich-editor-tool="${name}"]`).filter({ visible: true }).click();

  await page.locator(".ProseMirror").click();
  await tool("h2");
  await page.keyboard.type("Judul");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Halo ");
  await tool("bold");
  await page.keyboard.type("tebal");
  await tool("bold");
  await page.keyboard.type(" & 'kutip'");
  await page.keyboard.press("Enter");
  await tool("customBlocks");
  await page.locator(".fi-fo-rich-editor-custom-block-btn").click();

  const blockModal = page.locator(".fi-modal-open .fi-modal-window");

  await blockModal.locator('[id="mountedActionSchema0.label"]').fill("Belanja");
  await blockModal.locator('[id="mountedActionSchema0.url"]').fill("https://inofarma.com/promo");
  await blockModal.getByRole("button", { name: "Masukkan" }).click();
  await expect(page.locator(".fi-fo-rich-editor-custom-block-heading")).toHaveText("Tombol: Belanja");
  await page.getByRole("button", { name: "Buat", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/newsletter\/\d+\/edit$/);

  const [newsletter] = await db.select().from(newsletters).where(eq(newsletters.name, `${tag} Newsletter`));

  expect(newsletter.content).toBe(
    '<h2>Judul</h2><p>Halo <strong>tebal</strong> &amp; &#039;kutip&#039;</p><div data-type="customBlock" data-config="{&quot;label&quot;:&quot;Belanja&quot;,&quot;url&quot;:&quot;https:\\/\\/inofarma.com\\/promo&quot;}" data-id="button"></div>',
  );
  expect(newsletter).toMatchObject({ status: "draf", customHtml: null, previewText: null });

  await hydrated(page);
  await page.getByRole("button", { name: "Pratinjau" }).click();
  await expect(page.locator(".fi-modal-open .fi-modal-heading")).toHaveText("Pratinjau Newsletter");
  expect(await page.locator(".fi-modal-open iframe").getAttribute("srcdoc")).toContain("Belanja</a>");
  await page.locator(".fi-modal-open").getByRole("button", { name: "Kembali Mengedit" }).click();

  await page.getByRole("button", { name: "Kirim Email Uji" }).click();

  const emails = page.locator('.fi-modal-open [id="mountedActionSchema0.emails"]');

  await emails.fill("bukan-email");
  await emails.press("Enter");
  await page.locator(".fi-modal-open").getByRole("button", { name: "Kirim", exact: true }).click();
  await expect(page.locator(".fi-modal-open [data-validation-error]")).toHaveText("Kolom alamat Email harus berupa alamat email yang valid.");
});

test("only Konten staff reach the newsletters and subscribers, and only the Inbox's own staff the Inbox", async ({ page }) => {
  await signIn(page, people.kasir.email);

  for (const path of ["/admin/newsletter", "/admin/newsletter/create", "/admin/subscriber", "/admin/inbox", `/admin/inbox/${conversationId}`]) {
    expect((await page.goto(path))?.status(), path).toBe(403);
  }

  await signIn(page, people.admin.email);
  expect((await page.goto("/admin/inbox/999999999"))?.status()).toBe(404);
  expect((await page.goto("/admin/newsletter/999999999/edit"))?.status()).toBe(404);
});
