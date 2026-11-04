import { updateProductAction } from "@/server/admin/product-actions";

/** POST /admin/produk/{id}/simpan: EditProduct. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/produk/[id]/simpan">) {
  return updateProductAction(request, (await params).id);
}
