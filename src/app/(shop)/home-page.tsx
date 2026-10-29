import Home from "@/views/shop/Home";
import { featuredBranchCards } from "@/server/shop/branches";
import { homeContentForStorefront } from "@/server/shop/content/home";
import { shopperCoordinates } from "@/server/shop/location";

/** The storefront homepage; carousels, logos and texts are edited in the admin under Konten Website > Beranda. */
export async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const point = await shopperCoordinates(await searchParams);
  const [content, pharmacies] = await Promise.all([homeContentForStorefront(), featuredBranchCards(point)]);

  return <Home content={content} pharmacies={pharmacies} />;
}
