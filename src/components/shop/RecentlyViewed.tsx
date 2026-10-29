import ProductGrid from './ProductGrid';
import { useShopCatalog } from './data';
import useRecentlyViewed from './useRecentlyViewed';

/**
 * "Baru Dilihat" row for the desktop pages: up to six products the shopper
 * opened most recently on this device. Renders nothing until there is
 * something to show.
 */
export default function RecentlyViewed({ excludeId }: { excludeId?: string }) {
    const { shopProducts } = useShopCatalog();
    const ids = useRecentlyViewed(excludeId);

    const tiles = ids
        .map((id) => shopProducts.find((tile) => tile.id === id))
        .filter((tile): tile is ProductTile => Boolean(tile))
        .slice(0, 6);

    if (! tiles.length) {
        return null;
    }

    return (
        <section className="mt-12">
            <h2 className="mb-4 font-display text-xl text-brand">Baru Dilihat</h2>
            <ProductGrid products={tiles} />
        </section>
    );
}
