import { photoOperationAction } from "@/server/admin/product-actions";

/** POST /admin/produk/{id}/gambar/{image}/{utama|hapus}. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/produk/[id]/gambar/[imageId]/[operation]">) {
  const { id, imageId, operation } = await params;

  return photoOperationAction(request, id, imageId, operation);
}
