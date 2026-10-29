import { headers } from "next/headers";

/**
 * Shared bits for Route Handlers that stand in for Laravel controllers.
 */

/**
 * Stands in for Laravel's CSRF token on requests that change something: the browser
 * must say the request comes from this site, through the `Origin` header or, failing
 * that, `Sec-Fetch-Site`. Session cookies are SameSite=Lax as well.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");

  if (origin) {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");

    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }

  return request.headers.get("sec-fetch-site") === "same-origin";
}

/** Laravel's answer to a failed CSRF check. */
export function csrfMismatchResponse(): Response {
  return Response.json({ message: "CSRF token mismatch." }, { status: 419 });
}

/** The client's IP for rate limiting: the first `X-Forwarded-For` hop behind a proxy, else unknown. */
export async function clientIp(): Promise<string> {
  const list = await headers();

  return list.get("x-forwarded-for")?.split(",")[0]?.trim() || list.get("x-real-ip") || "unknown";
}

/** The JSON body, or an empty object when there is none or it isn't JSON. */
export async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();

    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
