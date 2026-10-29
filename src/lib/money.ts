/**
 * Rupiah formatting, ported from the Laravel app's resources/js/lib/format.ts
 * (screens) and App\Support\Money (plain-text bodies such as emails).
 *
 * Money is always a whole-rupiah integer; never pass a float or a formatted string.
 */

/**
 * Format a rupiah amount the way Indonesian storefronts display it: `Rp 1.350.000`.
 */
export function money(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString("id-ID")}`;
}

/**
 * Format a rupiah amount compactly, for dashboard tiles where the full figure
 * would not fit — 1250000 becomes "Rp 1,25 jt".
 */
export function moneyShort(amount: number): string {
  const units = [
    { limit: 1_000_000_000_000, suffix: " T", divisor: 1_000_000_000_000 },
    { limit: 1_000_000_000, suffix: " M", divisor: 1_000_000_000 },
    { limit: 1_000_000, suffix: " jt", divisor: 1_000_000 },
    { limit: 1_000, suffix: " rb", divisor: 1_000 },
  ];

  for (const unit of units) {
    if (Math.abs(amount) >= unit.limit) {
      const value = amount / unit.divisor;

      return `Rp ${value.toLocaleString("id-ID", { maximumFractionDigits: 2 })}${unit.suffix}`;
    }
  }

  return money(amount);
}

/**
 * Format a plain count with Indonesian thousand separators.
 */
export function count(value: number): string {
  return value.toLocaleString("id-ID");
}

/**
 * Rupiah as plain text with no space, for notification and email bodies: `Rp1.350.000`.
 * The server-side counterpart of `money()` (App\Support\Money::rupiah).
 */
export function rupiah(amount: number): string {
  const digits = Math.abs(Math.trunc(amount)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return `Rp${amount < 0 ? "-" : ""}${digits}`;
}
