/**
 * A thin client for Biteship's REST API, ported from
 * App\Support\Shipping\Biteship\BiteshipClient. Auth is one `Authorization: <api key>`
 * header. Booking (createOrder) and tracking come with the Biteship webhook (step 5).
 */
const BASE_URL = "https://api.biteship.com/v1";

/** Laravel's HTTP client has no timeout by default; a stuck courier API shouldn't hang checkout forever. */
const TIMEOUT_MS = 30_000;

export class BiteshipClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = BASE_URL,
  ) {}

  static fromConfig(): BiteshipClient {
    const apiKey = process.env.BITESHIP_API_KEY;

    if (!apiKey) {
      throw new Error("Biteship belum dikonfigurasi. Isi BITESHIP_API_KEY di .env.");
    }

    return new BiteshipClient(apiKey);
  }

  /**
   * Every courier company active on this Biteship account, for the `couriers` list
   * rates() needs, so one switched on or off in the dashboard is picked up. Biteship
   * lists one entry per service, so codes are de-duplicated.
   */
  async courierCodes(): Promise<string[]> {
    const body = await this.request("GET", "/couriers");
    const couriers = Array.isArray(body.couriers) ? (body.couriers as { courier_code?: unknown }[]) : [];

    return [...new Set(couriers.map((courier) => courier.courier_code).filter((code): code is string => typeof code === "string" && code !== ""))];
  }

  /** Quotes every available courier for a route and its items: Biteship's `pricing` list. */
  async rates(params: Record<string, unknown>): Promise<Record<string, unknown>[]> {
    const codes = await this.courierCodes();

    if (codes.length === 0) {
      return [];
    }

    const body = await this.request("POST", "/rates/couriers", { ...params, couriers: codes.join(",") });

    return Array.isArray(body.pricing) ? (body.pricing as Record<string, unknown>[]) : [];
  }

  private async request(method: "GET" | "POST", path: string, body?: unknown): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { Authorization: this.apiKey, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = await response.text();
    let json: unknown = null;

    try {
      json = JSON.parse(text);
    } catch {
      // not JSON: the raw text is the reason
    }

    if (!response.ok) {
      const error = (json as { error?: unknown } | null)?.error;

      throw new Error(explainBiteshipError(typeof error === "string" ? error : text, this.apiKey));
    }

    return typeof json === "object" && json !== null ? (json as Record<string, unknown>) : {};
  }
}

/**
 * Biteship's own wording is terse English. The two refusals staff can fix themselves in
 * the dashboard get a plain-Indonesian next step; anything else keeps Biteship's text.
 */
export function explainBiteshipError(reason: string, apiKey = ""): string {
  const lower = reason.toLowerCase();

  if (lower.includes("not been activated")) {
    const hint = apiKey.startsWith("biteship_test")
      ? "Key yang dipakai adalah key TEST. Di dashboard Biteship nyalakan Testing Mode, buat key di sana (Pengaturan > API Key, berlabel Development), lalu pasang di .env."
      : apiKey.startsWith("biteship_live")
        ? "Key yang dipakai adalah key LIVE, yang belum diaktifkan Biteship untuk membuat resi. Ajukan aktivasi (Go Live) di dashboard Biteship, atau pakai key TEST di .env selama masih uji coba."
        : "Jenis key tidak dikenali (harus diawali biteship_test atau biteship_live).";

    return `Biteship menolak: API key belum diaktifkan untuk membuat resi. ${hint} Setelah mengganti key, mulai ulang aplikasi. Pesan asli: ${reason}`;
  }

  if (lower.includes("balance") || lower.includes("saldo")) {
    return `Biteship menolak: saldo Biteship tidak cukup untuk membuat resi. Isi saldo di dashboard Biteship, lalu coba lagi. Pesan asli: ${reason}`;
  }

  return `Biteship menolak permintaan: ${reason}`;
}
