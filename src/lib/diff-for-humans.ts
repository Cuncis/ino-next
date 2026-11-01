import type { AdminLocale } from "./admin-i18n";

/**
 * Carbon's `diffForHumans()` for a past moment, in Indonesian or English:
 * "5 menit yang lalu" / "5 minutes ago". Whole units, rounded down; days become weeks
 * from 7 days; whole calendar months and years once a month has passed.
 */
const UNITS: Record<AdminLocale, Record<string, [string, string]>> = {
  id: { second: ["detik", "detik"], minute: ["menit", "menit"], hour: ["jam", "jam"], day: ["hari", "hari"], week: ["minggu", "minggu"], month: ["bulan", "bulan"], year: ["tahun", "tahun"] },
  en: { second: ["second", "seconds"], minute: ["minute", "minutes"], hour: ["hour", "hours"], day: ["day", "days"], week: ["week", "weeks"], month: ["month", "months"], year: ["year", "years"] },
};

function calendarMonths(from: Date, to: Date): number {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());

  if (to.getDate() < from.getDate() || (to.getDate() === from.getDate() && to.getTime() % 86_400_000 < from.getTime() % 86_400_000)) {
    months -= 1;
  }

  return Math.max(months, 0);
}

export function diffForHumans(date: Date, locale: AdminLocale, now = new Date()): string {
  const seconds = Math.max(Math.floor((now.getTime() - date.getTime()) / 1000), 0);
  const months = calendarMonths(date, now);
  let unit: string;
  let count: number;

  if (months >= 12) {
    [unit, count] = ["year", Math.floor(months / 12)];
  } else if (months >= 1) {
    [unit, count] = ["month", months];
  } else if (seconds >= 7 * 86_400) {
    [unit, count] = ["week", Math.floor(seconds / (7 * 86_400))];
  } else if (seconds >= 86_400) {
    [unit, count] = ["day", Math.floor(seconds / 86_400)];
  } else if (seconds >= 3600) {
    [unit, count] = ["hour", Math.floor(seconds / 3600)];
  } else if (seconds >= 60) {
    [unit, count] = ["minute", Math.floor(seconds / 60)];
  } else {
    [unit, count] = ["second", seconds];
  }

  const [one, many] = UNITS[locale][unit];

  return locale === "id" ? `${count} ${one} yang lalu` : `${count} ${count === 1 ? one : many} ago`;
}
