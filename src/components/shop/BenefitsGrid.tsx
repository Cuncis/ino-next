/**
 * "Keuntungan Belanja di Inofarma": reasons to shop here, each with its
 * benefit badge. Edited in the admin under Konten Website > Beranda.
 */
export default function BenefitsGrid({ benefits, className = 'grid-cols-3 px-3.5' }: { benefits: HomeContent['benefits'], className?: string }) {
    return (
        <div className={`grid gap-3 ${className}`}>
            {benefits.map((benefit, index) => (
                <div
                    key={`${index}-${benefit.label}`}
                    className="flex flex-col items-center gap-1.5 border border-line bg-white px-2 py-3.5 text-center"
                >
                    <img src={benefit.image} alt={benefit.label} className="h-9 w-9 object-contain" />
                    <span className="text-[9px] leading-tight text-ink">{benefit.label}</span>
                </div>
            ))}
        </div>
    );
}
