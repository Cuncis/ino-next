import { useState } from 'react';
import { router } from '@/lib/inertia';
import flyToCart from './flyToCart';

/**
 * One-tap "Tambah" for a product card.
 *
 * A cart is bound to one branch, and the cards have no branch picker, so this
 * takes the delivering branch when it has stock, else the first selectable
 * branch from the locator API (sorted nearest-first once the shopper has
 * shared a location), and posts a
 * single unit to the same `/keranjang` endpoint `BranchPicker` uses. When
 * the cart already holds another branch's items, the server's `branch` error
 * is put to the shopper as a confirm before the cart is switched.
 *
 * The header badge follows the shared `cartCount` prop, which refreshes with
 * the redirect that follows a successful add.
 */
export default function useAddToCart(productId: string): { add: (anchor: HTMLElement | null) => Promise<void>, processing: boolean, error: string } {
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');

    const submit = (branchId: string, switchBranch: boolean, anchor: HTMLElement | null) : void => {
        router.post(
            '/keranjang',
            { productId, branchId, quantity: 1, switchBranch },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => flyToCart(anchor),
                onError: (errors) => {
                    if (errors.branch) {
                        if (window.confirm(errors.branch)) {
                            submit(branchId, true, anchor);
                        }

                        return;
                    }

                    setError(Object.values(errors)[0] ?? 'Gagal menambahkan ke keranjang.');
                },
                onFinish: () => setProcessing(false),
            },
        );
    };

    const add = async (anchor: HTMLElement | null) => {
        setError('');
        setProcessing(true);

        try {
            const response = await fetch(`/api/cabang/untuk-produk/${productId}`, {
                headers: { Accept: 'application/json' },
            });

            if (! response.ok) {
                throw new Error('gagal memuat');
            }

            const { branches }: { branches: ProductBranch[] } = await response.json();
            // Prefer the branch that delivers, as the product page does: a cart bound to a
            // pickup-only branch has no "Kirim ke alamat" option at checkout.
            const branch = branches.find((candidate) => candidate.selectable && candidate.supportsDelivery)
                ?? branches.find((candidate) => candidate.selectable);

            if (! branch) {
                setError('Stok sedang kosong di semua cabang.');
                setProcessing(false);

                return;
            }

            submit(branch.id, false, anchor);
        } catch {
            setError('Tidak bisa menambahkan. Coba lagi nanti.');
            setProcessing(false);
        }
    };

    return { add, processing, error };
}
