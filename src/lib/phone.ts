/**
 * Digits-only international form: `0812-1401-8964` and `+62 812 1401 8964` both become
 * `6281214018964`. Ported from WhatsAppClient::normalizePhone(); DOKU and wa.me links need it.
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  return digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
}

/** `https://wa.me/6281214018964` for a stored phone number. */
export function whatsappUrl(phone: string): string {
  return `https://wa.me/${normalizePhone(phone)}`;
}
