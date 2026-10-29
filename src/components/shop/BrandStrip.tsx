import useDragScroll from './useDragScroll';

/**
 * "Brand Terlaris": a curated list of partner-brand logos carried at Apotek
 * Inofarma, edited in the admin under Konten Website > Beranda. It is not
 * derived from the catalogue's `Product.manufacturer`, whose names do not
 * match these consumer brands.
 *
 * `spread` lays the logos out as an even nine-column row filling the
 * container (desktop), instead of the scrolling strip of small circles.
 */
export default function BrandStrip({ brands, className = 'px-3.5', spread = false }: {
  brands: HomeContent['brands'],
  className?: string,
  spread?: boolean,
}) {
    const drag = useDragScroll();

    if (spread) {
        return (
            <div className={`grid grid-cols-9 gap-5 ${className}`}>
                {brands.map((brand, index) => (
                    <span
                        key={`${index}-${brand.name}`}
                        className="flex aspect-square items-center justify-center overflow-hidden rounded-full border border-line bg-white p-4"
                    >
                        <img src={brand.image} alt={brand.name} className="h-full w-full object-contain" />
                    </span>
                ))}
            </div>
        );
    }

    return (
        <div
            {...drag}
            className={`flex gap-3.5 overflow-x-auto scrollbar-none ${className} ${drag.className}`}
        >
            {brands.map((brand, index) => (
                <div key={`${index}-${brand.name}`} className="flex w-16 shrink-0 items-center justify-center text-center">
                    <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-line bg-white p-1.5">
                        <img src={brand.image} alt={brand.name} className="h-full w-full object-contain" />
                    </span>
                </div>
            ))}
        </div>
    );
}
