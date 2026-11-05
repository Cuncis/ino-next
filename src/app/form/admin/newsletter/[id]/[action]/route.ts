import { newsletterAction } from "@/server/admin/newsletter-actions";

/** POST /admin/newsletter/{id}/{simpan|hapus|uji|kirim}. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/newsletter/[id]/[action]">) {
  const { id, action } = await params;

  return newsletterAction(request, id, action);
}
