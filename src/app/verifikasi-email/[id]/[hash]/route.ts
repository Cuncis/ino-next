import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { customers, db } from "@/db";
import { redirectTo } from "@/lib/http";
import { throttle } from "@/lib/rate-limit";
import { hasValidSignature } from "@/lib/signed-url";
import { errorPageResponse } from "@/server/error-page";
import { emailHash } from "@/server/shop/customer-auth";

/**
 * The link in the verification email (signed, 60 minutes; throttle:6,1).
 * Ported from Shop\AuthController::verifyEmail().
 */
export async function GET(request: Request, { params }: RouteContext<"/verifikasi-email/[id]/[hash]">) {
  if (!hasValidSignature(request.url)) {
    return errorPageResponse(403, "Forbidden", "Invalid signature.");
  }

  const limited = await throttle("verifikasi-email", 6, 1);

  if (limited) {
    return limited;
  }

  const { id, hash } = await params;
  // Laravel looked the customer up without global scopes, so a deleted account still matches
  const [customer] = /^\d+$/.test(id) ? await db.select().from(customers).where(eq(customers.id, Number(id))).limit(1) : [];

  if (!customer) {
    return errorPageResponse(404, "Not Found");
  }

  const expected = Buffer.from(emailHash(customer.email));
  const given = Buffer.from(hash);

  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return errorPageResponse(403, "Forbidden");
  }

  if (!customer.emailVerifiedAt) {
    await db.update(customers).set({ emailVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(customers.id, customer.id));
  }

  return redirectTo(request, "/signin", { success: "Email berhasil diverifikasi." });
}
