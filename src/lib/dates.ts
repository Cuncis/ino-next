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
