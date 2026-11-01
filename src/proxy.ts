import { NextResponse, type NextRequest } from "next/server";
import { FLASH_COOKIE, FLASH_HEADER } from "@/lib/flash";
import { destroySession, SESSION_COOKIES, sessionCookieOptions } from "@/lib/session";
import { branchPageExists } from "@/server/shop/branches";
import { CartManager, exceedsPurchaseLimit, GUEST_CART_COOKIE, guestCartCookieOptions, OVER_LIMIT_MESSAGE } from "@/server/shop/cart";
import { customerForSessionToken } from "@/server/shop/customer-auth";
import { INACTIVE_MESSAGE } from "@/server/shop/customer-guard";
import { INTENDED_COOKIE } from "@/server/shop/intended";
import { LOCATION_COOKIE, locationCookieOptions } from "@/server/shop/location";
import { findCustomerOrder } from "@/server/shop/orders";

/**
 * Runs before every page and route, doing what Laravel's routing and middleware did:
 *
 * - A form posted to a page's own URL (Laravel's `GET /signin` + `POST /signin`) goes to
 *   its Route Handler under /form, since Next.js can't put a page and a handler at one path.
 * - Pages behind the `customer` middleware send signed-out visitors to /signin and
 *   remember where they were going; an account that is no longer active is signed out.
 * - `/apotek/{slug}` for a branch with no page, and `/pesanan/{nomor}` or `/track-order/{nomor}`
 *   for an order that isn't the customer's, answer 404 before the page streams.
 * - The cart and checkout send an empty (or over-limit) cart away before anything renders,
 *   as their Laravel controllers did; a redirect from a streaming page would paint it first.
 * - A flash message from the previous request is handed to this page, then forgotten.
 * - The shopper's sign-in, guest cart and saved location are renewed, like Laravel's session lifetime.
 */
const FORM_PATHS = new Set(["/signin", "/verify-phone", "/otp-code", "/add-new-address", "/privasi-saya", "/checkout", "/shipping-details"]);

/** Laravel's `customer` middleware group: the account pages. */
function isCustomerPage(pathname: string): boolean {
  return (
    ["/profile", "/edit-profile", "/my-address", "/add-new-address", "/privasi-saya", "/order-history", "/shipping-details"].includes(pathname) ||
    /^\/(pesanan|track-order)\/[^/]+$/.test(pathname)
  );
}

const CUSTOMER_COOKIE = SESSION_COOKIES.customer;

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (request.method !== "GET" && request.method !== "HEAD" && FORM_PATHS.has(pathname)) {
    return NextResponse.rewrite(new URL(`/form${pathname}${search}`, request.url));
  }

  const apotek = /^\/apotek\/([^/]+)\/?$/.exec(pathname);

  if (apotek && !(await branchPageExists(decodeURIComponent(apotek[1])))) {
    // no route matches this path, so the app's global 404 page answers with a 404 status
    return NextResponse.rewrite(new URL("/__not-found", request.url), { status: 404 });
  }

  const sessionToken = request.cookies.get(CUSTOMER_COOKIE)?.value;

  if (request.method === "GET" && isCustomerPage(pathname)) {
    const customer = await customerForSessionToken(sessionToken);

    if (!customer || customer.status !== "aktif") {
      const response = NextResponse.redirect(new URL("/signin", request.url));

      if (!customer) {
        response.cookies.set(INTENDED_COOKIE, `${pathname}${search}`, { httpOnly: true, sameSite: "lax", path: "/" });
      } else {
        await destroySession("customer", sessionToken);
        response.cookies.delete(CUSTOMER_COOKIE);
        response.cookies.set(FLASH_COOKIE, JSON.stringify({ error: INACTIVE_MESSAGE }), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 });
      }

      return response;
    }

    const order = /^\/(?:pesanan|track-order)\/([^/]+)$/.exec(pathname);

    if (order && !(await findCustomerOrder(customer.id, safeDecode(order[1])))) {
      // Laravel's abort(404, 'Pesanan tidak ditemukan.'), answered before the page streams
      return NextResponse.rewrite(new URL("/__not-found", request.url), { status: 404 });
    }
  }

  if (request.method === "GET" && (pathname === "/cart" || pathname === "/checkout")) {
    const away = await cartRedirect(request, pathname, sessionToken);

    if (away) {
      return away;
    }
  }

  const flash = request.cookies.get(FLASH_COOKIE)?.value;
  const requestHeaders = new Headers(request.headers);

  requestHeaders.delete(FLASH_HEADER);

  // a flash is for the next page a browser loads, not for its data fetches
  const handsOnFlash = flash !== undefined && request.method === "GET" && !pathname.startsWith("/api/");

  if (handsOnFlash) {
    requestHeaders.set(FLASH_HEADER, flash);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  if (handsOnFlash) {
    response.cookies.delete(FLASH_COOKIE);
  }

  // Renewed on page loads only: requests that change something (signing in or out,
  // filling a cart, saving a location) set or delete these cookies themselves.
  if (request.method === "GET") {
    if (sessionToken) {
      response.cookies.set(CUSTOMER_COOKIE, sessionToken, sessionCookieOptions(sessionToken));
    }

    const guestCart = request.cookies.get(GUEST_CART_COOKIE)?.value;

    if (guestCart) {
      response.cookies.set(GUEST_CART_COOKIE, guestCart, guestCartCookieOptions());
    }

    const location = request.cookies.get(LOCATION_COOKIE);

    if (location) {
      response.cookies.set(LOCATION_COOKIE, location.value, locationCookieOptions);
    }
  }

  return response;
}

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Shop\CartController::index() and CheckoutController::show()'s redirects, or null to render. */
async function cartRedirect(request: NextRequest, pathname: string, sessionToken: string | undefined): Promise<NextResponse | null> {
  const customer = await customerForSessionToken(sessionToken);
  const cart = await new CartManager(customer, request.cookies.get(GUEST_CART_COOKIE)?.value ?? null).current();
  const empty = !cart.branch || cart.lines.length === 0;

  if (pathname === "/cart") {
    return cart.lines.length === 0 ? NextResponse.redirect(new URL("/cart-empty", request.url), 302) : null;
  }

  const error = empty ? "Keranjang Anda masih kosong." : exceedsPurchaseLimit(cart.lines) ? OVER_LIMIT_MESSAGE : null;

  if (!error) {
    return null;
  }

  const response = NextResponse.redirect(new URL("/cart", request.url), 302);

  response.cookies.set(FLASH_COOKIE, JSON.stringify({ error }), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 });

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|media/|storage/|favicon.ico|icon.png|apple-icon.png|robots.txt).*)"],
};
