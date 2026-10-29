import { Link } from '@/lib/inertia';
import { useShopCatalog } from './data';

/**
 * Home-page quick-category shortcuts, right below the hero carousel.
 *
 * Reads the real admin-managed categories (`useShopCatalog().categories`)
 * so every badge links straight to `/shop?category=<name>` and lands on
 * that category already filtered, plus one "Semua Produk" tile appended at
 * the end that links to the unfiltered shop. Each badge is its `Category`
 * record's `image_path`, so the art and the filter always agree; both it and
 * the "Semua Produk" icon are replaced in the admin under Konten Website >
 * Beranda. The shipped art is self-hosted under
 * `public/media/images/categories/` (never depend on a third-party host
 * staying online for storefront artwork).
 *
 * Laid out as a table: only `border-r`/`border-b` on each cell plus
 * `border-l`/`border-t` on the grid itself, so shared edges between cells
 * never double up into a thicker line the way `border` on every cell would.
 *
 * Shares its category list with the "Kategori" page (`Categories.jsx`) so
 * the two screens always list the same set, in the same order.
 */
export default function CategoryShortcuts({ allProductsIcon, className = 'mx-3.5 my-3.5' }: { allProductsIcon: string, className?: string }) {
    const { categories } = useShopCatalog();

    const tiles = [
        ...categories,
        { name: 'Semua Produk', image: allProductsIcon },
    ];

    return (
        <div className={`grid grid-cols-4 border-l border-t border-line bg-white ${className}`}>
            {tiles.map((category) => (
                <Link
                    key={category.name}
                    href={
                        category.name === 'Semua Produk'
                            ? '/shop'
                            : `/shop?category=${encodeURIComponent(category.name)}`
                    }
                    className="group flex flex-col items-center justify-center gap-1.5 border-b border-r border-line px-1.5 py-3.5 text-center"
                >
                    <img
                        src={category.image}
                        alt={category.name}
                        className="h-11 w-11 object-contain transition-transform duration-500 ease-out group-hover:scale-110"
                    />

                    <span className="text-[11px] leading-tight text-ink">{category.name}</span>
                </Link>
            ))}
        </div>
    );
}
