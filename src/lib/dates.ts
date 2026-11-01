/**
 * Carbon's toIso8601String() for a stored timestamp: Jakarta time with its offset,
 * e.g. `2026-10-12T17:22:32+07:00`.
 */
export function iso8601(date: Date | null | undefined): string | null {
  if (!date) {
    return null;
  }

  return `${new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 19)}+07:00`;
}

/** Carbon's Indonesian short month names (it writes "Agt", where Intl writes "Agu"). */
export const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];

/**
 * Carbon's translatedFormat('d M Y') in Indonesian, in Jakarta time, or with
 * `withTime` its translatedFormat('d M Y, H:i'): `01 Nov 2026, 14:05`.
 */
export function indonesianDate(date: Date | null | undefined, withTime = false): string | null {
  if (!date) {
    return null;
  }

  const jakarta = new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString();
  const day = `${jakarta.slice(8, 10)} ${SHORT_MONTHS[Number(jakarta.slice(5, 7)) - 1]} ${jakarta.slice(0, 4)}`;

  return withTime ? `${day}, ${jakarta.slice(11, 16)}` : day;
}
