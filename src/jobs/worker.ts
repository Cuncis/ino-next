import cron from "node-cron";
import { APP_TIMEZONE } from "@/lib/timezone";

// Mirrors the Laravel scheduler in ~/inofarma/routes/console.php,
// which runs in the app timezone (config/app.php)
const timezone = APP_TIMEZONE;

// pesanan:kadaluwarsakan — return stock and expire orders unpaid after 24 hours
cron.schedule("*/5 * * * *", () => {}, { timezone, name: "expire-unpaid-orders" });

// pesanan:kadaluwarsakan-pengambilan — return stock for pickups uncollected after 48 hours
cron.schedule("*/5 * * * *", () => {}, { timezone, name: "expire-unclaimed-pickups" });

// notifikasi:produk-kedaluwarsa — warn admins about batches expiring within 30 days
cron.schedule("0 0 * * *", () => {}, { timezone, name: "notify-expiring-batches" });

// notifikasi:pengambilan-mendekati-batas — warn admins about pickups within 6 hours of the deadline
cron.schedule("0 * * * *", () => {}, { timezone, name: "notify-approaching-pickup-deadlines" });

console.log("Worker started");
