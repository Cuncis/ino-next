import { NextResponse, type NextRequest } from "next/server";
import { branchPageExists } from "@/server/shop/branches";
import { LOCATION_COOKIE, locationCookieOptions } from "@/server/shop/location";

/**
 * Runs before every page and route:
 *
 * - `/apotek/{slug}` for a branch with no page answers 404 here, before the page starts
 *   streaming (a streamed page has already sent 200).
 * - The shopper's saved location is renewed, like Laravel's session lifetime, which
 *   restarted on every request.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const apotek = /^\/apotek\/([^/]+)\/?$/.exec(pathname);

  if (apotek && !(await branchPageExists(decodeURIComponent(apotek[1])))) {
    // no route matches this path, so the app's global 404 page answers with a 404 status
    return NextResponse.rewrite(new URL("/__not-found", request.url), { status: 404 });
  }

  const response = NextResponse.next();
  const location = request.cookies.get(LOCATION_COOKIE);

  // /lokasi sets or deletes the cookie itself
  if (location && pathname !== "/lokasi") {
    response.cookies.set(LOCATION_COOKIE, location.value, locationCookieOptions);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|media/|storage/|favicon.ico|icon.png|apple-icon.png|robots.txt).*)"],
};
