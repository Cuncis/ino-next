import { Link } from '@/lib/inertia';

/**
 * "Apotek Inofarma Terdekat": a photo card per apotek, nearest first once the
 * shopper's location is known, each leading to that apotek's own page. The
 * list is every active branch with a photo (Cabang > Halaman Apotek in the
 * admin), passed in as `pharmacies`.
 */
export default function NearestPharmacies({ pharmacies, className = 'px-3.5', desktop = false }: {
    pharmacies: BranchCard[];
    className?: string;
    desktop?: boolean;
}) {
    return (
        <div
            className={`${className} ${
                desktop
                    ? 'grid grid-cols-4 gap-4'
                    : 'flex snap-x gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
            }`}
        >
            {pharmacies.map((pharmacy) => (
                <Link
                    key={pharmacy.slug}
                    href={`/apotek/${pharmacy.slug}`}
                    className={`block text-left ${desktop ? '' : 'w-[62%] shrink-0 snap-start'}`}
                >
                    <div className="aspect-[361/314] overflow-hidden rounded-2xl bg-canvas">
                        <img src={pharmacy.photoUrl} alt={pharmacy.name} loading="lazy" className="h-full w-full object-cover" />
                    </div>
                    <span className="mt-2 block text-[13px] font-semibold text-ink">{pharmacy.name}</span>
                </Link>
            ))}
        </div>
    );
}
