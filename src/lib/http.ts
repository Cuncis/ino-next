import { headers } from "next/headers";
import { flashForNextPage, type Flash } from "./flash";

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

/** True for requests from the storefront's own JavaScript (`@/lib/inertia` and fetch calls). */
export function wantsJson(request: Request): boolean {
  return request.headers.get("x-requested-with") === "XMLHttpRequest" || (request.headers.get("accept") ?? "").includes("application/json");
}

/**
 * Laravel's `redirect($url)->with(...)` for a controller action: JSON
 * `{ redirect, flash }` for a form request, else a 303 redirect with the flash in a cookie.
 */
export async function redirectTo(request: Request, url: string, flash?: Flash): Promise<Response> {
  if (wantsJson(request)) {
    return Response.json({ redirect: url, flash });
  }

  if (flash) {
    await flashForNextPage(flash);
  }

  return redirectResponse(url, 303);
}

/** Laravel's `back()`: the page the request came from. */
export function previousUrl(request: Request, fallback = "/"): string {
  const referer = request.headers.get("referer");

  if (!referer) {
    return fallback;
  }

  try {
    const url = new URL(referer);

    return url.host === new URL(request.url).host ? `${url.pathname}${url.search}` : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Inertia::location(): leave the app for another site (DOKU's payment page). The Inertia
 * client gets a 409 naming the URL and does a full page visit; a plain form gets a redirect.
 */
export function externalRedirect(request: Request, url: string): Response {
  return wantsJson(request) ? Response.json({ location: url }, { status: 409 }) : redirectResponse(url, 303);
}

/**
 * A redirect with the Location as given: a path stays relative, so the browser resolves it
 * against the address it used. (`request.url` in a Route Handler carries the address the
 * server listens on, e.g. 0.0.0.0 in development, where the session cookie isn't sent.)
 */
export function redirectResponse(location: string, status: 301 | 302 | 303 = 302): Response {
  return new Response(null, { status, headers: { Location: location } });
}
