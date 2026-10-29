import { useState } from 'react';
import { router } from '@/lib/inertia';

/**
 * Quantity, removal and promo-code actions of the Cart page, shared by its
 * phone and desktop layouts. All of them go through the same endpoints and
 * keep the scroll position.
 */
export default function useCartActions() {
    const [busySku, setBusySku] = useState<string | null>(null);
    const [promo, setPromo] = useState('');
    const [couponError, setCouponError] = useState('');

    const changeQuantity = (item: CartLine, quantity: number) => {
        setBusySku(item.sku);

        router.patch(
            `/keranjang/${item.sku}`,
            { quantity },
            { preserveScroll: true, onFinish: () => setBusySku(null) },
        );
    };

    const removeItem = (item: CartLine) => {
        setBusySku(item.sku);

        router.delete(`/keranjang/${item.sku}`, {
            preserveScroll: true,
            onFinish: () => setBusySku(null),
        });
    };

    const applyPromo = () => {
        if (! promo.trim()) {
            return;
        }

        setCouponError('');

        router.post(
            '/keranjang/kupon',
            { code: promo.trim() },
            {
                preserveScroll: true,
                onSuccess: () => setPromo(''),
                onError: (errors) => setCouponError(errors.code ?? ''),
            },
        );
    };

    const removePromo = () => {
        router.delete('/keranjang/kupon', { preserveScroll: true });
    };

    return { busySku, promo, setPromo, couponError, changeQuantity, removeItem, applyPromo, removePromo };
}
