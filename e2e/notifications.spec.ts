import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { Worker } from "bullmq";
import { and, desc, eq, inArray, like, sql } from "drizzle-orm";
import {
  auditLogs,
  branches,
  chatConversations,
  chatMessages,
  customers,
  db,
  modelHasPermissions,
  newsletterDeliveries,
  newsletters,
  notifications,
  orders,
  payments,
  permissions,
  subscribers,
  users,
} from "../src/db";
import { removeTestCustomers } from "./support/remove-test-customers";

// The app queues its messages in Redis; this file works that queue itself, with a real
// BullMQ worker in the test process whose emails stay in memory (MAIL_MAILER=array).
// It places a real order, chats, and sends a newsletter to the development database's
// subscribers (into memory only). Everything it creates is removed afterwards.
process.loadEnvFile(".env.local");
process.env.MAIL_MAILER = "array";
process.env.CHAT_EMAIL_DELAY_MINUTES = "0";
delete process.env.WHATSAPP_TOKEN;

const stamp = Date.now();
const email = `zz-notify-${stamp}@example.com`;
const chatEmail = `zz-chat-${stamp}@example.com`;
const readerEmail = `zz-reader-${stamp}@example.com`;
const SKU = "ID106232-1"; // in stock at CB-014; no other spec counts it
const BRANCH = "CB-014";

type Order = typeof orders.$inferSelect;

test.describe.configure({ mode: "serial" });

let page: Page;
let worker: Worker;
let staffId: number;
let order: Order;
let mail: typeof import("../src/lib/mail");
let whatsapp: typeof import("../src/server/notifications/whatsapp");

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  const { redis } = await import("../src/lib/redis");

  for (const pattern of ["throttle:*", "limiter:*"]) {
    const keys = await redis.keys(pattern);

    if (keys.length) await redis.del(...keys);
  }

  redis.disconnect();

  mail = await import("../src/lib/mail");
  whatsapp = await import("../src/server/notifications/whatsapp");

  const { handleJob } = await import("../src/jobs/handlers");
  const { QUEUE_NAME, queueConnection } = await import("../src/lib/queue");

  worker = new Worker(QUEUE_NAME, async (job) => handleJob(job.name as never, job.data as never), { connection: queueConnection() });

  // a staff member of the branch who may read the chat inbox
  const [branch] = await db.select({ id: branches.id }).from(branches).where(eq(branches.code, BRANCH));
  const [staff] = await db
    .insert(users)
    .values({ name: "ZZ Staff", email: `zz-staff-${stamp}@example.com`, password: "x", branchId: branch.id, isActive: true, createdAt: new Date(), updatedAt: new Date() })
    .returning();
  const [inbox] = await db.select().from(permissions).where(and(eq(permissions.name, "Inbox:Lihat"), eq(permissions.guardName, "web")));

  staffId = staff.id;
  await db.insert(modelHasPermissions).values({ permissionId: inbox.id, modelType: "App\\Models\\User", modelId: staff.id });
});

test.afterAll(async () => {
  await worker.close();
  await page.close();
  await removeTestCustomers("zz-notify-%@example.com");

  const conversations = await db.select({ id: chatConversations.id }).from(chatConversations).where(like(chatConversations.email, "zz-chat-%"));

  if (conversations.length) {
    // every inbox reader was told about the test chat, real staff too
    for (const { id } of conversations) {
      await db.delete(notifications).where(sql`${notifications.data}->'actions'->0->>'url' like ${`%/admin/inbox/${id}`}`);
    }

    await db.delete(chatMessages).where(inArray(chatMessages.chatConversationId, conversations.map((c) => c.id)));
    await db.delete(chatConversations).where(inArray(chatConversations.id, conversations.map((c) => c.id)));
  }

  const zzNewsletters = await db.select({ id: newsletters.id }).from(newsletters).where(like(newsletters.name, "ZZ %"));

  if (zzNewsletters.length) {
    await db.delete(newsletterDeliveries).where(inArray(newsletterDeliveries.newsletterId, zzNewsletters.map((n) => n.id)));
    await db.delete(newsletters).where(inArray(newsletters.id, zzNewsletters.map((n) => n.id)));
  }

  await db.delete(subscribers).where(like(subscribers.email, "zz-%"));
  await db.delete(notifications).where(eq(notifications.notifiableId, staffId));
  await db.delete(modelHasPermissions).where(eq(modelHasPermissions.modelId, staffId));
  await db.delete(users).where(eq(users.id, staffId));

  const { closeQueue } = await import("../src/lib/queue");

  await closeQueue();
  await db.$client.end();
});

const headersFor = (p: Page) => ({ Accept: "application/json", Origin: new URL(p.url()).origin });

const mailTo = (address: string, subject: string | RegExp) =>
  expect.poll(() => mail.sentMail.find((sent) => sent.to.includes(address) && (typeof subject === "string" ? sent.subject === subject : subject.test(sent.subject))), { timeout: 20_000 });

const staffNotes = () => db.select().from(notifications).where(eq(notifications.notifiableId, staffId)).orderBy(desc(notifications.createdAt));

async function notifyDoku(request: APIRequestContext, payload: unknown) {
  const { dokuDigest, dokuSign } = await import("../src/server/payments/doku-signature");
  const body = JSON.stringify(payload);
  const requestId = randomUUID();
  const timestamp = new Date().toISOString().slice(0, 19) + "Z";

  return request.post("/doku/notifikasi", {
    headers: {
      "Content-Type": "application/json",
      "Client-Id": process.env.DOKU_CLIENT_ID!,
      "Request-Id": requestId,
      "Request-Timestamp": timestamp,
      Signature: dokuSign(process.env.DOKU_CLIENT_ID!, requestId, timestamp, "/doku/notifikasi", dokuDigest(body), process.env.DOKU_SECRET_KEY!),
    },
    data: body,
  });
}

test("an order's life sends the customer's emails and WhatsApp, and tells the branch", async () => {
  test.setTimeout(180_000);

  await page.goto(`/product-detail?id=${SKU}`);

  const headers = headersFor(page);

  expect((await page.request.post("/keranjang", { data: { productId: SKU, branchId: BRANCH, quantity: 1 }, headers })).ok()).toBe(true);

  const placed = await page.request.post("/checkout", {
    data: { fulfilment: "ambil", paymentMethod: "online", pickupBranchId: BRANCH, email, name: "ZZ Notify", phone: `0896${String(stamp).slice(-8)}`, consent: true },
    headers,
    timeout: 60_000,
  });

  expect([200, 409]).toContain(placed.status());

  const [customer] = await db.select().from(customers).where(eq(customers.email, email));

  [order] = await db.select().from(orders).where(eq(orders.customerId, customer.id));

  // OrderConfirmed, to the address alone
  await mailTo(email, `Pesanan #${order.number} Diterima — Inofarma`).toMatchObject({ to: email });

  const confirmed = mail.sentMail.find((sent) => sent.subject === `Pesanan #${order.number} Diterima — Inofarma`)!;

  expect(confirmed.text).toContain("Pesanan Anda #" + order.number + " dari Apotek Inofarma Pisangan Lama sudah kami terima.");
  expect(confirmed.text).toContain(`Lacak Pesanan: ${process.env.APP_URL}/track-order/${order.number}`);

  // NewOrderAtBranch in the staff member's bell, and the audit trail
  const orderLink = `${process.env.APP_URL}/admin/pesanan/${order.id}`;

  // (the other specs' orders at this branch reach this staff member too)
  await expect.poll(async () => (await staffNotes()).find((note) => (note.data as { actions: { url: string }[] }).actions[0].url === orderLink)?.data).toMatchObject({
    title: "Pesanan baru",
    body: expect.stringMatching(new RegExp(`^#${order.number} — Rp`)),
    format: "filament",
    actions: [{ label: "Lihat Pesanan", url: orderLink }],
  });

  const [audit] = await db.select().from(auditLogs).where(and(eq(auditLogs.action, "pesanan_dibuat"), eq(auditLogs.auditableId, order.id)));

  expect(audit).toMatchObject({ auditableType: "App\\Models\\Order", branchId: order.branchId, userId: null, newValues: { number: order.number, fulfilment: "ambil", grand_total: order.grandTotal } });
  expect(audit.userAgent).toContain("Mozilla");

  // paid: PaymentReceived
  const [attempt] = await db.select().from(payments).where(eq(payments.orderId, order.id));

  if (!attempt) {
    await db.insert(payments).values({ orderId: order.id, invoiceNumber: order.number, status: "pending", amount: order.grandTotal, createdAt: new Date(), updatedAt: new Date() });
  }

  await notifyDoku(page.request, { order: { invoice_number: order.number, amount: order.grandTotal }, transaction: { status: "SUCCESS" }, channel: { id: "QRIS" } });
  await mailTo(email, `Bukti Bayar Pesanan #${order.number} — Inofarma`).toBeTruthy();
  // (this worker also handles the other specs' jobs, so each email is found by its order)
  expect(mail.sentMail.find((sent) => sent.subject === `Bukti Bayar Pesanan #${order.number} — Inofarma`)!.text).toContain("Metode: QRIS");

  // ready at the counter (staff do this in the admin): email and WhatsApp with the code
  const { transaction } = await import("../src/lib/queue");
  const { updateOrder } = await import("../src/server/orders/order-updates");
  const [paid] = await db.select().from(orders).where(eq(orders.id, order.id));

  await transaction(db, (tx) => updateOrder(paid, { status: "siap diambil", pickupCode: "ZZ7Q2P", pickupCodeExpiresAt: new Date(Date.now() + 48 * 3600_000), readyAt: new Date() }, tx));
  await mailTo(email, `Pesanan #${order.number} Siap Diambil — Inofarma`).toBeTruthy();
  await expect
    .poll(() => whatsapp.loggedWhatsApp.find((sent) => sent.message.parameters[1] === order.number)?.message)
    .toEqual({ template: "pesanan_siap_diambil", parameters: ["ZZ Notify", order.number, "ZZ7Q2P"], logFallback: `Pesanan #${order.number} siap diambil. Kode: ZZ7Q2P.` });

  // a change rolled back sends nothing
  const [ready] = await db.select().from(orders).where(eq(orders.id, order.id));

  await expect(
    transaction(db, async (tx) => {
      await updateOrder(ready, { status: "selesai" }, tx);
      throw new Error("rolled back");
    }),
  ).rejects.toThrow("rolled back");
  await new Promise((resolve) => setTimeout(resolve, 1500));
  expect(mail.sentMail.find((sent) => sent.subject === `Pesanan #${order.number} Selesai — Inofarma`)).toBeUndefined();
});

test("the chat starts a conversation, tells the inbox once, and emails a reply the visitor hasn't seen", async ({ request }) => {
  // refused with Laravel's messages
  const invalid = await request.post("/api/chat", { data: { name: "", email: "nope", message: "" } });

  expect(invalid.status()).toBe(422);
  expect((await invalid.json()).errors).toEqual({
    name: ["Kolom nama wajib diisi."],
    email: ["Kolom email harus berupa alamat email yang valid."],
    message: ["Kolom pesan wajib diisi."],
  });

  const started = await request.post("/api/chat", { data: { name: "ZZ Chat", email: chatEmail.toUpperCase(), message: "  Apakah Imboost tersedia?  ", subscribe: true } });

  expect(started.status()).toBe(201);

  const { token, messages } = await started.json();

  expect(token).toHaveLength(40);
  expect(messages).toEqual([{ id: expect.any(Number), sender: "pengunjung", body: "Apakah Imboost tersedia?", createdAt: expect.stringMatching(/\+07:00$/) }]);

  const [conversation] = await db.select().from(chatConversations).where(eq(chatConversations.token, token));

  expect(conversation).toMatchObject({ email: chatEmail, status: "terbuka", adminUnreadCount: 1 });
  expect((await db.select().from(subscribers).where(eq(subscribers.email, chatEmail)))[0]).toMatchObject({ status: "berlangganan" });

  // the inbox hears about the first message of a wait, not every message
  const second = await request.post("/api/chat/pesan", { data: { message: "Halo?" }, headers: { "X-Chat-Token": token } });

  expect(second.status()).toBe(201);
  await expect.poll(async () => (await staffNotes()).filter((note) => (note.data as { title: string }).title === "Pesan baru dari ZZ Chat").length).toBe(1);
  await new Promise((resolve) => setTimeout(resolve, 1000));
  expect((await staffNotes()).filter((note) => (note.data as { title: string }).title === "Pesan baru dari ZZ Chat")).toHaveLength(1);
  expect((await db.select().from(chatConversations).where(eq(chatConversations.id, conversation.id)))[0].adminUnreadCount).toBe(2);

  // an admin reply the visitor doesn't see is emailed, quoted
  const { addMessage, FROM_ADMIN } = await import("../src/server/chat");

  await addMessage(conversation, FROM_ADMIN, "Tersedia, kak.\nSilakan pesan.", staffId);
  await mailTo(chatEmail, "Balasan dari Apotek Inofarma").toBeTruthy();

  const reply = mail.sentMail.find((sent) => sent.to.includes(chatEmail))!;

  expect(reply.to).toBe(`"ZZ Chat" <${chatEmail}>`);
  expect(reply.text).toContain("> Tersedia, kak. > Silakan pesan.");
  expect(reply.text).toContain(`Lanjutkan chat: ${process.env.APP_URL}?chat=${token}`);

  // a reply seen in the open chat before the email is due is never emailed
  await worker.pause();
  await addMessage(conversation, FROM_ADMIN, "Ada lagi?", staffId);

  const polled = await request.get(`/api/chat?after=0&open=1`, { headers: { "X-Chat-Token": token } });

  expect((await polled.json()).unread).toBe(0);
  worker.resume();
  await new Promise((resolve) => setTimeout(resolve, 1500));
  expect(mail.sentMail.filter((sent) => sent.to.includes(chatEmail))).toHaveLength(1);

  // without the token there is no conversation
  expect((await request.get("/api/chat", { headers: { "X-Chat-Token": "short" } })).status()).toBe(404);

  // "Lacak Pesanan" needs the order number and the account's email together
  const tracked = await request.post("/api/chat/lacak-pesanan", { data: { order_number: order.number, email: email.toUpperCase() } });

  expect(await tracked.json()).toEqual({
    order: {
      number: order.number,
      status: "Siap Diambil",
      step: "Siap Diambil",
      payment: "Sudah dibayar",
      fulfilment: "Ambil",
      date: expect.any(String),
      total: order.grandTotal,
      courier: null,
      waybill: null,
    },
  });

  const wrong = await request.post("/api/chat/lacak-pesanan", { data: { order_number: order.number, email: chatEmail } });

  expect(wrong.status()).toBe(404);
  expect(await wrong.json()).toEqual({ message: "Pesanan tidak ditemukan. Periksa nomor pesanan dan alamat email Anda." });
});

test("the newsletter: sign up in the footer, unsubscribe by link, and a send reaches everyone subscribed", async ({ request }) => {
  test.setTimeout(120_000);

  await page.goto("/");

  const signedUp = await page.request.post("/newsletter/berlangganan", { data: { email: readerEmail }, headers: headersFor(page) });

  expect((await signedUp.json()).flash).toEqual({ success: "Terima kasih! Anda sudah berlangganan info sehat dan hemat dari Inofarma." });

  const refused = await page.request.post("/newsletter/berlangganan", { data: { email: "nope" }, headers: headersFor(page) });

  expect((await refused.json()).errors).toEqual({ email: ["Alamat email tidak valid."] });

  // a send goes to every subscriber, each with their own link
  const [reader] = await db.select().from(subscribers).where(eq(subscribers.email, readerEmail));
  const subscribed = await db.select({ id: subscribers.id }).from(subscribers).where(eq(subscribers.status, "berlangganan"));
  const [newsletter] = await db
    .insert(newsletters)
    .values({ name: `ZZ ${stamp}`, subject: "ZZ Promo", previewText: "Hemat", content: '<p>Halo</p><p><a href="/shop">Belanja</a></p>', status: "mengirim", createdAt: new Date(), updatedAt: new Date() })
    .returning();
  const { dispatch } = await import("../src/lib/queue");

  await dispatch("send-newsletter", { newsletterId: newsletter.id });
  await expect.poll(async () => (await db.select().from(newsletters).where(eq(newsletters.id, newsletter.id)))[0].status, { timeout: 60_000 }).toBe("terkirim");

  const [sent] = await db.select().from(newsletters).where(eq(newsletters.id, newsletter.id));

  expect(sent).toMatchObject({ successCount: subscribed.length, failedCount: 0 });

  const copy = mail.sentMail.find((m) => m.to === readerEmail && m.subject === "ZZ Promo")!;
  const link = `${process.env.APP_URL}/newsletter/berhenti/${reader.unsubscribeToken}`;

  expect(copy.headers).toEqual({ "List-Unsubscribe": `<${link}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" });
  expect(copy.html).toContain(`href="${process.env.APP_URL}/shop"`);

  // sending it again mails nobody twice
  await db.update(newsletters).set({ status: "mengirim" }).where(eq(newsletters.id, newsletter.id));
  await dispatch("send-newsletter", { newsletterId: newsletter.id });
  await expect.poll(async () => (await db.select().from(newsletters).where(eq(newsletters.id, newsletter.id)))[0].status).toBe("terkirim");
  expect(mail.sentMail.filter((m) => m.to === readerEmail && m.subject === "ZZ Promo")).toHaveLength(1);

  // the link only asks; the POST (a mail app's one-click button too) unsubscribes
  const path = `/newsletter/berhenti/${reader.unsubscribeToken}`;
  const asked = await request.get(path);

  expect(await asked.text()).toContain(`Anda tidak akan lagi menerima newsletter Apotek Inofarma di <strong>${readerEmail}</strong>.`);
  expect((await db.select().from(subscribers).where(eq(subscribers.id, reader.id)))[0].status).toBe("berlangganan");

  const done = await request.post(path, { headers: { Origin: "https://mail.example" } });

  expect(await done.text()).toContain("Anda sudah berhenti berlangganan");
  expect((await db.select().from(subscribers).where(eq(subscribers.id, reader.id)))[0]).toMatchObject({ status: "berhenti" });
  expect((await request.get("/newsletter/berhenti/nope")).status()).toBe(404);
});
