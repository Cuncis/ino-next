import ProductCell from './ProductCell';
import useDragScroll from './useDragScroll';

/**
 * A horizontal-scrolling row of product cards — the shape Home's
 * product-heading sections all share (Rekomendasi Untukmu, Produk Kesehatan
 * Terbaru, Produk Terlaris Kami). Kept separate from the portrait grid tile
 * (`ProductCard`, used by Shop/Wishlist's 2-column grids) since this one is
 * sized for a scrolling strip, not a grid cell.
 */
export default function ProductStrip({ products }: { products: ProductTile[] }) {
    const drag = useDragScroll();

    return (
        <div className="mx-3.5 border-l border-t border-line">
            <div {...drag} className={`flex overflow-x-auto scrollbar-none ${drag.className}`}>
                {products.map((product) => (
                    <ProductCell key={product.id} product={product} compact className="w-[38%] shrink-0" />
                ))}
            </div>
        </div>
    );
}
