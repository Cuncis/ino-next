import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * DOKU's "non-SNAP" HMAC signature, used by DOKU Checkout, the Check Status API and its
 * HTTP notifications alike. Ported from App\Support\Payments\Doku\DokuSignature.
 *
 * One `Label:value` line per component, in this order, joined by `\n`:
 * Client-Id, Request-Id, Request-Timestamp (ISO 8601 UTC), Request-Target (the path),
 * and Digest (base64 SHA-256 of the raw body; left out for GET). HMAC-SHA256 that with
 * the Secret Key, base64 it, prefix `HMACSHA256=`. A notification is verified by
 * recomputing it from what DOKU sent and comparing in constant time.
 */
export function dokuDigest(rawBody: string): string {
  return createHash("sha256").update(rawBody).digest("base64");
}

export function dokuSign(clientId: string, requestId: string, timestamp: string, requestTarget: string, digest: string | null, secretKey: string): string {
  const lines = [`Client-Id:${clientId}`, `Request-Id:${requestId}`, `Request-Timestamp:${timestamp}`, `Request-Target:${requestTarget}`];

  if (digest !== null) {
    lines.push(`Digest:${digest}`);
  }

  return `HMACSHA256=${createHmac("sha256", secretKey).update(lines.join("\n")).digest("base64")}`;
}

/**
 * @param headers lower-case keys: client-id, request-id, request-timestamp, signature
 */
export function dokuVerify(
  headers: Record<string, string | null | undefined>,
  rawBody: string,
  requestTarget: string,
  expectedClientId: string,
  secretKey: string,
): boolean {
  const clientId = headers["client-id"];
  const requestId = headers["request-id"];
  const timestamp = headers["request-timestamp"];
  const signature = headers.signature;

  if (!clientId || !requestId || !timestamp || !signature) {
    return false;
  }

  // a notification for another merchant is refused whatever its signature says
  if (!safeEqual(expectedClientId, clientId)) {
    return false;
  }

  return safeEqual(dokuSign(clientId, requestId, timestamp, requestTarget, dokuDigest(rawBody), secretKey), signature);
}

function safeEqual(expected: string, given: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(given);

  return a.length === b.length && timingSafeEqual(a, b);
}
