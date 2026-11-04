import { reorderPhotosAction } from "@/server/admin/product-actions";

/** POST /admin/produk/{id}/gambar/urutan: the photos in their new order. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/produk/[id]/gambar/urutan">) {
  return reorderPhotosAction(request, (await params).id);
}
