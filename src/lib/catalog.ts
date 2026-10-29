import { usePage } from '@/lib/inertia';

/**
 * The catalogue, read from the server.
 *
 * This file used to hold the products themselves. It no longer does: the shop
 * and the admin both read the `products` table, so an edit in the admin shows
 * up in the shop on the next request. What is left here is the shape of that
 * data and the derived views the screens ask for.
 *
 * `catalog` is a shared Inertia prop — see `HandleInertiaRequests::share()`.
 */

const EMPTY: Catalog = { products: [], categories: [] };

/**
 * The catalogue for the current page.
 *
 * Falls back to empty rather than throwing, so a screen that renders before the
 * prop exists (or in a test that stubs the page) degrades to "nothing to show"
 * instead of a blank error.
 */
export function useCatalog(): Catalog {
    return usePage().props.catalog ?? EMPTY;
}

/**
 * Look a product up by SKU, falling back to the first so a detail screen always
 * has something to render.
 */
export function findProduct(products: CatalogProduct[],id?: string): CatalogProduct | undefined {
    return products.find((product) => product.id === id) ?? products[0];
}

export function productsInCategory(products: CatalogProduct[],name: string): CatalogProduct[] {
    return products.filter((product) => product.category === name);
}

/**
 * Best sellers first.
 */
export function bestSellers(products: CatalogProduct[]): CatalogProduct[] {
    return [...products].sort((a, b) => b.sold - a.sold);
}

/**
 * Everything currently discounted.
 */
export function discounted(products: CatalogProduct[]): CatalogProduct[] {
    return products.filter((product) => product.oldPrice);
}
