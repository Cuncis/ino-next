import { nearestBranches } from "@/server/shop/branches";
import { shopperCoordinates } from "@/server/shop/location";

/** Every active branch, nearest first when the shopper's location is known. Ported from BranchLocatorController::nearest(). */
export async function GET(request: Request) {
  const point = await shopperCoordinates(new URL(request.url).searchParams);

  return Response.json({ branches: await nearestBranches(point) });
}
