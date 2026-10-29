import { branchesForProduct } from "@/server/shop/branches";
import { shopperCoordinates } from "@/server/shop/location";

/**
 * Every active branch carrying a product (by SKU), in stock and nearest first.
 * Ported from BranchLocatorController::forProduct().
 */
export async function GET(request: Request, { params }: RouteContext<"/api/cabang/untuk-produk/[product]">) {
  const point = await shopperCoordinates(new URL(request.url).searchParams);
  const branches = await branchesForProduct((await params).product, point);

  if (!branches) {
    return Response.json({ message: "Produk tidak ditemukan." }, { status: 404 });
  }

  return Response.json({ branches });
}
