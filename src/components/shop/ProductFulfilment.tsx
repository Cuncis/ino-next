import { Link } from '@/lib/inertia';

/**
 * "Dikirim dari: <branch>" on the product page. There is one origin for every
 * product (the branch that delivers), shown as a link to the full catalogue.
 * Pickup is not chosen here any more: the shopper picks the pickup location at
 * checkout.
 */
export default function ProductFulfilment({
    origin,
    className = '',
}: {
    origin: ProductBranch | null;
    className?: string;
}) {
    if (! origin) {
        return null;
    }

    return (
        <p className={`text-[13px] ${className}`}>
            <span className="text-muted">Dikirim dari: </span>
            <Link href="/shop" className="font-bold text-brand underline">
                {origin.name}
            </Link>
            {! origin.selectable ? <span className="ml-2 text-[12px] font-semibold text-danger">Stok kosong</span> : null}
        </p>
    );
}
