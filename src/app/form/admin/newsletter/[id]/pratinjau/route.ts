import { previewNewsletterAction } from "@/server/admin/newsletter-actions";

/** POST /admin/newsletter/{id}/pratinjau. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/newsletter/[id]/pratinjau">) {
  return previewNewsletterAction(request, (await params).id);
}
