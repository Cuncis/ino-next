import { usePage } from '@/lib/inertia';

/**
 * The shopper's cart item count, shared from `HandleInertiaRequests` — same
 * source `TabBar`'s own badge already reads, just exposed for the header
 * cart icon too.
 */
export default function useCartCount(): number {
    const { cartCount } = usePage().props;

    return cartCount ?? 0;
}
