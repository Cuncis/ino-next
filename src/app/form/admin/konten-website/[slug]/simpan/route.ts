import { saveContentAction } from "@/server/admin/website-content-actions";

/** POST /admin/konten-website/{slug}/simpan. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/konten-website/[slug]/simpan">) {
  return saveContentAction(request, (await params).slug);
}
