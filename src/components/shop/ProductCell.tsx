import { Link } from '@/lib/inertia';
import useAddToCart from './useAddToCart';

/**
 * One product in the storefront's table layout: photo, brand, name, price and
 * a full-width action. Shared by the desktop `ProductGrid` and the mobile
 * `ProductStrip` so a product looks identical on both. Borders are only
 * `border-r`/`border-b`, so the parent supplies `border-l`/`border-t` and
 * neighbouring cells share their edges.
 *
 * "Tambah" puts one unit in the cart (see `useAddToCart`). Out-of-stock items
 * get a disabled grey button.
 */
export default function ProductCell({ product, compact = false, className = '' }: {
  product: { id: string, name: string, image: string, price: string, brand: string, soldOut: boolean },
  compact?: boolean,
  className?: string,
}) {
    const { add, processing, error } = useAddToCart(product.id);

    return (
        <div className={`flex flex-col border-b border-r border-line bg-white ${compact ? 'p-2.5' : 'p-4'} ${className}`}>
            <Link href={`/product-detail?id=${product.id}`} className="block">
                <img
                    src={product.image}
                    alt={product.name}
                    className={`w-full object-contain ${compact ? 'mb-3 h-24' : 'mb-5 h-32'}`}
                />

                <div className="text-[9px] uppercase text-muted">{product.brand}</div>

                <div className="mt-1.5 line-clamp-2 min-h-10 text-[11px] font-medium leading-5 text-brand">
                    {product.name}
                </div>

                <div className={`mt-1.5 text-success ${compact ? 'mb-3 text-[13px]' : 'mb-4 text-[15px]'}`}>{product.price}</div>
            </Link>

            {product.soldOut ? (
                <span className={`mt-auto flex ${compact ? 'h-7' : 'h-8'} items-center justify-center rounded-[2px] bg-[#8b929a] text-[11px] font-bold text-white`}>
                    Terjual habis
                </span>
            ) : (
                <button
                    type="button"
                    onClick={(event) => add(event.currentTarget)}
                    disabled={processing}
                    className={`mt-auto flex ${compact ? 'h-7' : 'h-8'} items-center justify-center rounded-[2px] bg-success text-[11px] font-bold text-white disabled:opacity-60`}
                >
                    {processing ? 'Menambah...' : 'Tambah'}
                </button>
            )}

            {error ? <p className="mt-1.5 text-[10px] leading-tight text-danger">{error}</p> : null}
        </div>
    );
}
