import { previewNewsletterAction } from "@/server/admin/newsletter-actions";

/** POST /admin/newsletter/pratinjau: the create page's form as an email. */
export async function POST(request: Request) {
  return previewNewsletterAction(request, null);
}
