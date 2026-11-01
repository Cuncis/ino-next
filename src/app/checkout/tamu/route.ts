/** GET /checkout/tamu: the old guest checkout URL; guests now use /checkout like everyone. */
export function GET(request: Request) {
  return Response.redirect(new URL("/checkout", request.url), 302);
}
