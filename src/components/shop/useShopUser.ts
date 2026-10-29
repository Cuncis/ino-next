import { usePage } from '@/lib/inertia';

/**
 * The signed-in customer, shared from `HandleInertiaRequests` via the
 * `customer` guard (Fase 3.3).
 *
 * Falls back to the design's placeholder shopper so the screens still read
 * correctly when nobody has signed in yet.
 */
export default function useShopUser(): { name: string, email: string, phone: string, signedIn: boolean } {
    const { shopUser } = usePage().props;

    return {
        name: shopUser?.name || 'Kirana Wijaya',
        email: shopUser?.email || 'kirana.wijaya@mail.com',
        phone: shopUser?.phone || '+62 812-3456-7890',
        signedIn: Boolean(shopUser),
    };
}
