import { useState } from 'react';
import { Link, router } from '@/lib/inertia';
import Icon from './Icon';

/**
 * @typedef {object} Product
 * @property {string} name
 * @property {string} image
 * @property {string} price
 * @property {string} [oldPrice]
 * @property {string} rating
 */

/**
 * Portrait product card used by the grids on Shop and Wishlist — same card
 * treatment (white background, rounded-[2px] corners, light border) as Home's
 * `ProductStrip` tiles, so a product looks the same wherever it shows up.
 *
 * The tile opens the product detail screen; the heart toggles locally and the
 * bag sends the shopper to the cart.
 */
export default function ProductCard({ product, wishlisted = false, onRemove }: { product: ProductTile, wishlisted?: boolean, onRemove?: () => void }) {
    const [liked, setLiked] = useState(wishlisted);

    const toggleLike = () => {
        if (onRemove) {
            onRemove();

            return;
        }

        setLiked((current) => ! current);
    };

    return (
        <div className="overflow-hidden rounded-[2px] border border-line bg-white">
            <div className="relative aspect-3/4 overflow-hidden bg-white">
                <Link href="/product-detail" className="block h-full w-full">
                    <img
                        src={product.image}
                        alt={product.name}
                        className="h-full w-full object-cover"
                    />
                </Link>

                <div className="pointer-events-none absolute left-[7px] top-[7px] flex items-center gap-[3px] bg-white/90 px-[7px] py-[3px]">
                    <Icon name="star" size={11} className="text-star" />
                    <span className="text-[10px] font-bold">{product.rating}</span>
                </div>

                <button
                    type="button"
                    onClick={toggleLike}
                    aria-label={liked ? `Hapus ${product.name} dari favorit` : `Tambahkan ${product.name} ke favorit`}
                    className={`absolute bottom-8 right-0 flex h-8 w-8 items-center justify-center bg-white/90 ${
                        liked ? 'text-brand' : 'text-faint'
                    }`}
                >
                    <Icon name={liked ? 'heartFilled' : 'heart'} size={18} />
                </button>

                <button
                    type="button"
                    onClick={() => router.visit('/cart')}
                    aria-label={`Masukkan ${product.name} ke keranjang`}
                    className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center bg-white/90 text-faint"
                >
                    <Icon name="bagSimple" size={18} />
                </button>
            </div>

            <Link href="/product-detail" className="block px-2 py-2">
                <div className="mb-[3px] truncate text-xs text-[#333333]">
                    {product.name}
                </div>

                <div className="flex items-center gap-[5px]">
                    {product.oldPrice ? (
                        <span className="text-[9px] text-faint line-through">
                            {product.oldPrice}
                        </span>
                    ) : null}

                    <span
                        className={`text-xs font-bold ${
                            product.oldPrice ? 'text-brand' : 'text-muted'
                        }`}
                    >
                        {product.price}
                    </span>
                </div>
            </Link>
        </div>
    );
}
