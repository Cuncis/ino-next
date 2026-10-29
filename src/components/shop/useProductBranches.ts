import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The branches that carry one product, with this product's stock at each and
 * (once the shopper's location is known) their distance. `reload` fetches
 * again, for after the shopper shares a location or enters a postal code.
 */
export default function useProductBranches(productId: string) {
    const [branches, setBranches] = useState<ProductBranch[] | null>(null);
    const [error, setError] = useState('');
    const latest = useRef(0);

    const reload = useCallback(async () => {
        const ticket = ++latest.current;

        try {
            const response = await fetch(`/api/cabang/untuk-produk/${productId}`, {
                headers: { Accept: 'application/json' },
            });

            if (! response.ok) {
                throw new Error('gagal memuat');
            }

            const body: { branches: ProductBranch[] } = await response.json();

            if (ticket === latest.current) {
                setBranches(body.branches);
                setError('');
            }
        } catch {
            if (ticket === latest.current) {
                setError('Tidak bisa memuat daftar cabang. Coba lagi nanti.');
            }
        }
    }, [productId]);

    useEffect(() => {
        void reload();

        return () => {
            latest.current++;
        };
    }, [reload]);

    return { branches, error, reload };
}

/**
 * The branch a product is added to the cart from, and shipped from: the one
 * branch that delivers. If delivery is switched off everywhere, the first
 * pickup branch that has stock, so the product stays buyable.
 */
export function originBranch(branches: ProductBranch[]): ProductBranch | null {
    return branches.find((branch) => branch.supportsDelivery)
        ?? branches.find((branch) => branch.supportsPickup && branch.selectable)
        ?? null;
}
