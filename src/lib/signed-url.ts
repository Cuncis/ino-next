import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Laravel's URL::temporarySignedRoute() / hasValidSignature(): a link that only works
 * unchanged and until it expires, e.g. the email verification link. Same shape as
 * Laravel's (`?expires=<unix time>&signature=<hex HMAC-SHA256 of the URL>`), signed with
 * APP_KEY; a link signed with one of APP_PREVIOUS_KEYS still checks out, as in Laravel.
 */
function key(): string {
  const appKey = process.env.APP_KEY;

  if (!appKey) {
    throw new Error("APP_KEY belum diisi di .env");
  }

  return appKey;
}

function sign(url: string, signingKey = key()): string {
  return createHmac("sha256", signingKey).update(url).digest("hex");
}

function previousKeys(): string[] {
  return (process.env.APP_PREVIOUS_KEYS ?? "")
    .split(",")
    .map((previous) => previous.trim())
    .filter((previous) => previous !== "");
}

/** `path` is absolute ("https://...") or app-relative ("/verifikasi-email/1/abc"). */
export function temporarySignedUrl(path: string, expiresInMinutes: number): string {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const url = new URL(path, `${base}/`);

  url.searchParams.set("expires", String(Math.floor(Date.now() / 1000) + expiresInMinutes * 60));

  const unsigned = url.toString();

  return `${unsigned}&signature=${sign(unsigned)}`;
}

/**
 * Whether a request's URL carries a valid, unexpired signature. The URL is checked as
 * APP_URL plus the request's path and query, so it holds behind a proxy too.
 */
export function hasValidSignature(requestUrl: string): boolean {
  const incoming = new URL(requestUrl);
  const signature = incoming.searchParams.get("signature") ?? "";
  const expires = Number(incoming.searchParams.get("expires"));

  if (!signature || !Number.isFinite(expires) || expires < Date.now() / 1000) {
    return false;
  }

  incoming.searchParams.delete("signature");

  const base = (process.env.APP_URL ?? incoming.origin).replace(/\/+$/, "");
  const given = Buffer.from(signature);

  return [key(), ...previousKeys()].some((signingKey) => {
    const expected = Buffer.from(sign(`${base}${incoming.pathname}${incoming.search}`, signingKey));

    return expected.length === given.length && timingSafeEqual(expected, given);
  });
}
