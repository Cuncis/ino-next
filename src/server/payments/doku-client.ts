import { randomUUID } from "node:crypto";
import { dokuDigest, dokuSign } from "./doku-signature";

/**
 * A thin client for DOKU's REST API, ported from App\Support\Payments\Doku\DokuClient:
 * two endpoints and one signature scheme, so no third-party package.
 */
const TIMEOUT_MS = 30_000;

export class DokuClient {
  constructor(
    private readonly baseUrl: string,
    private readonly clientId: string,
    private readonly secretKey: string,
  ) {}

  static fromConfig(): DokuClient {
    const clientId = process.env.DOKU_CLIENT_ID;
    const secretKey = process.env.DOKU_SECRET_KEY;

    if (!clientId || !secretKey) {
      throw new Error("DOKU belum dikonfigurasi. Isi DOKU_CLIENT_ID dan DOKU_SECRET_KEY di .env.");
    }

    return new DokuClient(dokuBaseUrl(), clientId, secretKey);
  }

  /** Opens a DOKU Checkout payment session. */
  async createPayment(body: unknown, requestId: string): Promise<Record<string, unknown>> {
    const path = "/checkout/v1/payment";
    const json = JSON.stringify(body);
    const timestamp = utcTimestamp();
    const signature = dokuSign(this.clientId, requestId, timestamp, path, dokuDigest(json), this.secretKey);

    return this.send(path, { method: "POST", headers: { ...this.headers(requestId, timestamp, signature), "Content-Type": "application/json" }, body: json });
  }

  /**
   * DOKU's own record of a transaction's status: for reconciling a payment whose webhook
   * is late or lost, never the primary source of truth (the webhook is).
   */
  async checkStatus(invoiceNumber: string): Promise<Record<string, unknown>> {
    const path = `/orders/v1/status/${invoiceNumber}`;
    const requestId = randomUUID();
    const timestamp = utcTimestamp();
    const signature = dokuSign(this.clientId, requestId, timestamp, path, null, this.secretKey);

    return this.send(path, { method: "GET", headers: this.headers(requestId, timestamp, signature) });
  }

  private headers(requestId: string, timestamp: string, signature: string): Record<string, string> {
    return { "Client-Id": this.clientId, "Request-Id": requestId, "Request-Timestamp": timestamp, Signature: signature, Accept: "application/json" };
  }

  private async send(path: string, init: RequestInit): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.baseUrl}${path}`, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const text = await response.text();
    let json: unknown = null;

    try {
      json = JSON.parse(text);
    } catch {
      // not JSON: the raw text is the reason
    }

    if (!response.ok) {
      const reason = (json as { error_messages?: unknown[] } | null)?.error_messages?.[0];

      throw new Error(`DOKU menolak permintaan: ${typeof reason === "string" ? reason : text}`);
    }

    return typeof json === "object" && json !== null ? (json as Record<string, unknown>) : {};
  }
}

export function dokuBaseUrl(): string {
  return ["1", "true", "on", "yes"].includes((process.env.DOKU_PRODUCTION ?? "").toLowerCase()) ? "https://api.doku.com" : "https://api-sandbox.doku.com";
}

/** gmdate('Y-m-d\TH:i:s\Z'): ISO 8601 in UTC, without milliseconds. */
function utcTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}
