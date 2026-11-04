import { productOperationAction } from "@/server/admin/product-actions";

/** POST /admin/produk/{id}/{hapus|hapus-permanen|pulihkan}. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/produk/[id]/[operation]">) {
  const { id, operation } = await params;

  return productOperationAction(request, id, operation);
}
