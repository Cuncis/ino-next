import { redirectResponse } from "@/lib/http";

/** GET /checkout/tamu: the old guest checkout URL; guests now use /checkout like everyone. */
export function GET() {
  return redirectResponse("/checkout", 302);
}
