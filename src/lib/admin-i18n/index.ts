import appEn from "./app.en.json";
import appId from "./app.id.json";

/**
 * The admin panel's languages, Indonesian (default) and English, switched from the user
 * menu. Like the Laravel app, text is written in Indonesian and `__()` looks it up:
 * app.en.json / app.id.json are copies of its lang/en.json and lang/id.json, and
 * FILAMENT_EN holds the English of Filament's own interface text (its lang files).
 */
export type AdminLocale = "id" | "en";

export const ADMIN_LOCALES: AdminLocale[] = ["id", "en"];

/** Filament's own interface strings: Indonesian as Filament writes it, and its English. */
const FILAMENT_EN: Record<string, string> = {
  Dasbor: "Dashboard",
  Keluar: "Sign out",
  "Buka notifikasi": "Notifications",
  "Menu pengguna": "User menu",
  "Persempit menu": "Collapse sidebar",
  "Perluas menu": "Expand sidebar",
  "Mode Gelap": "Enable dark theme",
  "Mode Terang": "Enable light theme",
  "Sesuai tema perangkat": "Enable system theme",
  "Avatar :name": "Avatar of :name",
  Cari: "Search",
  "Pencarian global": "Global search",
  "Pencarian tidak ditemukan.": "No search results found.",
  Tutup: "Close",
  Notifikasi: "Notifications",
  Bersihkan: "Clear",
  "Tandai semua sudah dibaca": "Mark all as read",
  "Tidak ada notifikasi": "No notifications",
  "Silakan periksa kembali nanti": "Please check again later.",
  "Apakah Anda yakin ingin melakukan ini?": "Are you sure you would like to do this?",
  Batal: "Cancel",
  Konfirmasi: "Confirm",
  Kirim: "Submit",
  Filter: "Filters",
  "Atur ulang filter": "Reset",
  "Terapkan filter": "Apply filters",
};

const EN: Record<string, string> = { ...FILAMENT_EN, ...(appEn as Record<string, string>) };
const ID: Record<string, string> = appId as Record<string, string>;

/** Laravel's `__($text, $replace)` for the admin. */
export function translate(locale: AdminLocale, text: string, replace: Record<string, string | number> = {}): string {
  const found = (locale === "en" ? EN : ID)[text] ?? text;

  return Object.entries(replace).reduce((result, [key, value]) => result.replaceAll(`:${key}`, String(value)), found);
}

export function isAdminLocale(value: unknown): value is AdminLocale {
  return value === "id" || value === "en";
}
