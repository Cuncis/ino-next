import { createNewsletterAction } from "@/server/admin/newsletter-actions";

/** POST /admin/newsletter/buat. */
export async function POST(request: Request) {
  return createNewsletterAction(request);
}
