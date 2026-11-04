import { uploadPhotosAction } from "@/server/admin/product-actions";

/** POST /admin/produk/{id}/gambar/unggah: Upload Gambar. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/produk/[id]/gambar/unggah">) {
  return uploadPhotosAction(request, (await params).id);
}
